# -*- coding: utf-8 -*-

from odoo import models, fields, api, tools


class AccountTaxDetailsReport(models.Model):
    _name = "account.tax.details.report"
    _description = "Tax Details"
    _auto = False
    _order = 'base_line_id, tax_id, tax_line_id'

    base_line_id = fields.Many2one(
        comodel_name='account.move.line',
        string="Base Journal Item",
        readonly=True,
        required=True,
    )
    tax_line_id = fields.Many2one(
        comodel_name='account.move.line',
        string="Tax Journal Item",
        readonly=True,
        required=True,
    )
    tax_id = fields.Many2one(
        comodel_name='account.tax',
        string="Originator Tax",
        readonly=True,
        required=True,
    )
    base_amount = fields.Monetary(
        string="Base Amount",
        readonly=True,
        currency_field='company_currency_id',
    )
    tax_amount = fields.Monetary(
        string="Tax Amount",
        readonly=True,
        currency_field='company_currency_id',
    )
    company_id = fields.Many2one(
        comodel_name='res.company',
        string="Company",
    )
    company_currency_id = fields.Many2one(
        comodel_name='res.currency',
    )

    def init(self):
        self._cr.execute('''
            CREATE OR REPLACE VIEW account_tax_details_report AS (

                /*
                Sub-query <base_line_id, tax_ids> flattening group of taxes.
                */

                WITH tax_ids_m2m AS (
                    SELECT
                        tax_rel.account_move_line_id AS base_line_id,
                        ARRAY_AGG(tax_rel.account_tax_id ORDER BY tax.sequence, tax.id) AS tax_ids
                    FROM account_move_line_account_tax_rel tax_rel
                    JOIN account_tax tax ON tax.id = tax_rel.account_tax_id
                    WHERE tax.amount_type != 'group'
                    GROUP BY tax_rel.account_move_line_id

                    UNION ALL

                    SELECT
                        tax_rel.account_move_line_id AS base_line_id,
                        ARRAY_AGG(group_tax_rel.child_tax ORDER BY tax.sequence, tax.id) AS tax_ids
                    FROM account_move_line_account_tax_rel tax_rel
                    JOIN account_tax tax ON tax.id = tax_rel.account_tax_id
                    JOIN account_tax_filiation_rel group_tax_rel ON group_tax_rel.parent_tax = tax.id
                    WHERE tax.amount_type = 'group'
                    GROUP BY tax_rel.account_move_line_id
                ),

                /*
                Sub-query mapping each base line with the associated tax lines.
                */

                base_line_tax_line_mapping AS (
                    SELECT
                        base_line.id AS base_line_id,
                        tax_line.id AS tax_line_id,
                        base_line.balance AS base_amount,
                        SUM(
                            CASE WHEN tax.amount_type = 'fixed'
                            THEN COALESCE(base_line.quantity, 1.0)
                            ELSE base_line.balance
                            END
                        ) OVER (PARTITION BY tax_line.id ORDER BY tax_line.tax_line_id, base_line.id) AS cumulated_base_amount,
                        SUM(
                            CASE WHEN tax.amount_type = 'fixed'
                            THEN COALESCE(base_line.quantity, 1.0)
                            ELSE base_line.balance
                            END
                        ) OVER (PARTITION BY tax_line.id) AS total_base_amount,
                        tax_line.balance AS total_tax_amount,

                        base_line.company_id,
                        tax_line.tax_line_id AS tax_id,
                        comp_curr.id AS company_currency_id,
                        comp_curr.decimal_places AS comp_curr_prec
                    FROM account_move_line tax_line
                    JOIN res_currency comp_curr ON comp_curr.id = tax_line.company_currency_id
                    JOIN account_tax tax ON tax.id = tax_line.tax_line_id
                    LEFT JOIN tax_ids_m2m tax_rel ON tax_rel.base_line_id = tax_line.id
                    JOIN account_move_line base_line ON
                        base_line.move_id = tax_line.move_id
                        AND COALESCE(base_line.partner_id, 0) = COALESCE(tax_line.partner_id, 0)
                        AND base_line.currency_id = tax_line.currency_id
                    JOIN tax_ids_m2m base_tax_rel ON base_tax_rel.base_line_id = base_line.id
                    WHERE
                        CASE WHEN tax_rel.tax_ids IS NULL THEN
                            base_tax_rel.tax_ids @> ARRAY[tax_line.tax_line_id]
                        ELSE
                            base_tax_rel.tax_ids[ARRAY_LENGTH(base_tax_rel.tax_ids, 1) - ARRAY_LENGTH(tax_rel.tax_ids, 1):ARRAY_LENGTH(base_tax_rel.tax_ids, 1)] 
                                = ARRAY[tax_line.tax_line_id] || tax_rel.tax_ids
                        END
                ),

                /*
                Sub-query <base_line_id, tax_line_id, base_amount, tax_amount> containing each tax line spread into
                base lines. When some taxes affecting the base of subsequent ones are involved, the corresponding
                tax lines are considered as base lines for the following taxes.
                */

                raw_tax_details AS (
                    SELECT
                        mapping.base_line_id,
                        mapping.tax_line_id,
                        mapping.tax_id,
                        mapping.company_id,
                        mapping.company_currency_id,
                        mapping.base_amount,
                        ROUND(
                            COALESCE(mapping.total_tax_amount * mapping.cumulated_base_amount / NULLIF(mapping.total_base_amount, 0.0), 0.0),
                            mapping.comp_curr_prec
                        )
                        - LAG(ROUND(
                            COALESCE(mapping.total_tax_amount * mapping.cumulated_base_amount / NULLIF(mapping.total_base_amount, 0.0), 0.0),
                            mapping.comp_curr_prec
                        ), 1, 0.0)
                        OVER (
                            PARTITION BY mapping.tax_line_id ORDER BY mapping.tax_id, mapping.base_line_id
                        ) AS tax_amount
                    FROM base_line_tax_line_mapping mapping
                ),

                /*
                Sub-query mapping each base line being a tax line affecting the base of subsequent ones with their
                following tax lines. Then, such lines are spread into the originator base lines in order to retrieve
                the 'real' base amount.
                */

                affect_base_tax_line_mapping AS (
                    SELECT
                        base_line.id AS base_line_id,
                        tax_base_line.id AS tax_base_line_id,
                        tax_line.id AS tax_line_id,
                        tax_details.base_amount,
                        SUM(
                            CASE WHEN tax.amount_type = 'fixed'
                            THEN COALESCE(base_line.quantity, 1.0)
                            ELSE base_line.balance
                            END
                        ) OVER (PARTITION BY tax_base_line.id ORDER BY tax_base_line.tax_line_id, base_line.id) AS cumulated_base_amount,
                        SUM(
                            CASE WHEN tax.amount_type = 'fixed'
                            THEN COALESCE(base_line.quantity, 1.0)
                            ELSE base_line.balance
                            END
                        ) OVER (PARTITION BY tax_base_line.id) AS total_base_amount,
                        tax_details.tax_amount AS total_tax_amount,

                        base_line.company_id,
                        tax_line.tax_line_id AS tax_id,
                        comp_curr.id AS company_currency_id,
                        comp_curr.decimal_places AS comp_curr_prec
                    FROM raw_tax_details tax_details
                    JOIN account_move_line tax_base_line ON tax_base_line.id = tax_details.base_line_id
                    JOIN tax_ids_m2m tax_rel ON tax_rel.base_line_id = tax_base_line.id
                    JOIN account_move_line tax_line ON tax_line.id = tax_details.tax_line_id
                    JOIN res_currency comp_curr ON comp_curr.id = tax_line.company_currency_id
                    JOIN account_tax tax ON tax.id = tax_line.tax_line_id
                    JOIN account_move_line base_line ON
                        base_line.move_id = tax_line.move_id
                        AND COALESCE(base_line.partner_id, 0) = COALESCE(tax_line.partner_id, 0)
                        AND base_line.currency_id = tax_line.currency_id
                    JOIN tax_ids_m2m base_tax_rel ON base_tax_rel.base_line_id = base_line.id
                    WHERE tax_base_line.tax_line_id IS NOT NULL
                    AND base_line.tax_line_id IS NULL
                    AND base_tax_rel.tax_ids[ARRAY_LENGTH(base_tax_rel.tax_ids, 1) - ARRAY_LENGTH(tax_rel.tax_ids, 1):ARRAY_LENGTH(base_tax_rel.tax_ids, 1)]
                        = ARRAY[tax_base_line.tax_line_id] || tax_rel.tax_ids
                ),

                full_tax_details AS (
                    -- Tax details created by taxes affecting the base of subsequent ones.
                    SELECT
                        tax_details.base_line_id,
                        tax_details.tax_line_id,
                        tax_details.tax_id,
                        tax_details.company_id,
                        tax_details.company_currency_id,
                        tax_details.base_amount,
                        ROUND(
                            tax_details.total_tax_amount * tax_details.cumulated_base_amount / tax_details.total_base_amount,
                            tax_details.comp_curr_prec
                        )
                        - LAG(ROUND(
                            tax_details.total_tax_amount * tax_details.cumulated_base_amount / tax_details.total_base_amount,
                            tax_details.comp_curr_prec
                        ), 1, 0.0)
                        OVER (PARTITION BY tax_details.tax_base_line_id, tax_details.tax_line_id ORDER BY tax_details.tax_id, tax_details.base_line_id) AS tax_amount
                    FROM affect_base_tax_line_mapping tax_details

                    UNION ALL

                    -- Regular tax details .
                    SELECT
                        tax_details.*
                    FROM raw_tax_details tax_details
                    JOIN account_move_line base_line ON base_line.id = tax_details.base_line_id
                    WHERE base_line.tax_line_id IS NULL
                )

                SELECT
                    tax_details.base_line_id || ',' || tax_details.tax_line_id AS id,
                    tax_details.base_line_id,
                    tax_details.tax_line_id,
                    tax_details.tax_id,
                    tax_details.company_id,
                    tax_details.company_currency_id,
                    SUM(tax_details.base_amount) AS base_amount,
                    SUM(tax_details.base_amount) AS tax_amount
                FROM full_tax_details tax_details
                GROUP BY
                    tax_details.base_line_id,
                    tax_details.tax_line_id,
                    tax_details.tax_id,
                    tax_details.company_id,
                    tax_details.company_currency_id
            )
        ''')
