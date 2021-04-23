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
                tax_details_per_line_tax AS (
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
                )
                SELECT
                    tax_details.base_line_id || ',' || tax_details.tax_line_id AS id,
                    tax_details.base_line_id,
                    tax_details.tax_line_id,
                    tax_details.tax_id,
                    tax_details.company_id,
                    tax_details.company_currency_id,
                    tax_details.base_amount,
                    ROUND(
                        COALESCE(tax_details.total_tax_amount * tax_details.cumulated_base_amount / NULLIF(tax_details.total_base_amount, 0.0), 0.0),
                        tax_details.comp_curr_prec
                    )
                    - LAG(ROUND(
                        COALESCE(tax_details.total_tax_amount * tax_details.cumulated_base_amount / NULLIF(tax_details.total_base_amount, 0.0), 0.0),
                        tax_details.comp_curr_prec
                    ), 1, 0.0)
                    OVER (
                        PARTITION BY tax_details.tax_line_id ORDER BY tax_details.tax_id, tax_details.base_line_id
                    ) AS tax_amount
                FROM tax_details_per_line_tax tax_details
            )
        ''')
