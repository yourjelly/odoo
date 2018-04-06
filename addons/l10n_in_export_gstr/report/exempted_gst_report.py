# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import tools
from odoo import models, fields, api


class ExemptedGstReport(models.Model):
    _name = "exempted.gst.report"
    _description = "Exempted gst supplied Statistics"
    _auto = False

    out_type_of_supply = fields.Selection([('intrb2b', 'Inter-State supplies to registered persons'),
                                    ('intrb2c', 'Inter-State supplies to unregistered persons'),
                                    ('intrab2b', 'Intra-State supplies to registered persons'),
                                    ('intrab2c', 'Intra-State supplies to unregistered persons')],"OUT Type of supply")
    in_type_of_supply = fields.Selection([('intr', 'Inter-State supplies'),
                                    ('intra', 'Intra-State supplies')], "IN Type of supply")
    composition_amount = fields.Float('Composition amount')
    nil_rated_amount = fields.Float("Nil rated supplies")
    exempted_amount = fields.Float("Exempted")
    non_gst_supplies = fields.Float("Non GST Supplies")
    invoice_month = fields.Char("Invoice Month")
    company_id = fields.Integer("Company")
    type = fields.Selection([('out_invoice', 'Customer Invoice'), ('in_invoice', 'Vendor Bill')], readonly=True)

    @api.model_cr
    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self._cr.execute("""
            CREATE OR REPLACE VIEW %s AS (
                SELECT concat(sub.in_type_of_supply, '-', sub.out_type_of_supply, '-', sub.invoice_month, '-', sub.company_id) as id,
                    sub.out_type_of_supply,
                    sub.in_type_of_supply,
                    sub.invoice_month,
                    sub.company_id,
                    sub.type,
                    sum(sub.composition_amount) AS composition_amount,
                    SUM(sub.exempted_amount) AS exempted_amount,
                    SUM(sub.non_gst_supplies) AS non_gst_supplies,
                    SUM(sub.nil_rated_amount) AS nil_rated_amount
                    FROM ( SELECT
                            ailtax.out_type_of_supply,
                            ailtax.in_type_of_supply,
                            ailtax.invoice_month,
                            ailtax.company_id,
                            ailtax.type,
                            CASE WHEN ailtax.composition
                                THEN ailtax.price_total
                                ELSE 0
                            END as composition_amount,
                            CASE WHEN ARRAY[NULL]::int[] = ailtax.tax_group_id
                                THEN ailtax.price_total
                                ELSE 0
                            END AS exempted_amount,

                            CASE WHEN not ARRAY[%s, %s, %s]::int[] && ailtax.tax_group_id AND not ARRAY[NULL]::int[] = ailtax.tax_group_id
                                THEN ailtax.price_total
                                ELSE 0
                            END AS non_gst_supplies,

                            CASE WHEN ARRAY[
                                    (SELECT res_id FROM ir_model_data WHERE module='%s' AND name=concat(ailtax.company_id,'_','%s')),
                                    (SELECT res_id FROM ir_model_data WHERE module='%s' AND name=concat(ailtax.company_id,'_','%s')),
                                    (SELECT res_id FROM ir_model_data WHERE module='%s' AND name=concat(ailtax.company_id,'_','%s')),
                                    (SELECT res_id FROM ir_model_data WHERE module='%s' AND name=concat(ailtax.company_id,'_','%s'))]::int[] && ailtax.tax_ids
                                THEN ailtax.price_total
                                ELSE 0
                            END as nil_rated_amount
                        FROM(SELECT ail.id AS invoice_line_id,
                                ai.company_id,
                                p.composition AS composition,
                                cp.state_id AS company_state_id,
                                to_char(ai.date_invoice::timestamp with time zone, 'MM-YYYY'::text) AS invoice_month,
                                p.state_id AS partner_state_id,
                                p.vat AS partner_gstn,
                                ail.price_subtotal_signed AS price_total,
                                ai.type,
                                array_agg(taxmin.id) AS tax_ids,
                                array_agg(taxmin.tax_group_id) AS tax_group_id,
                                (CASE WHEN ai.type = 'out_invoice' THEN
                                    (CASE WHEN (cp.state_id != p.state_id OR p.state_id IS NULL OR cp.state_id IS NULL) AND p.vat IS NOT NULL
                                        THEN 'intrb2b'
                                        WHEN (cp.state_id != p.state_id OR p.state_id IS NULL OR cp.state_id IS NULL) AND p.vat IS NULL
                                        THEN 'intrb2c'
                                        WHEN cp.state_id = p.state_id AND p.vat IS NOT NULL
                                        THEN 'intrab2b'
                                        WHEN cp.state_id = p.state_id AND p.vat IS NULL
                                        THEN 'intrab2c'
                                    END) ELSE NULL END) AS out_type_of_supply,
                                (CASE WHEN ai.type = 'in_invoice' THEN
                                        (CASE WHEN cp.state_id = p.state_id THEN 'intra' ELSE 'intr' END)
                                    ELSE NULL END) AS in_type_of_supply
                                FROM account_invoice_line ail
                                    JOIN account_invoice ai ON ai.id = ail.invoice_id
                                    JOIN res_company comp ON comp.id = ai.company_id
                                    JOIN res_partner cp ON cp.id = comp.partner_id
                                    JOIN res_partner p ON p.id = ai.commercial_partner_id
                                    LEFT JOIN ( SELECT  atax.id AS id,
                                        ailts.invoice_line_id AS a_invoice_line_id,
                                        CASE WHEN atax.amount_type::text = 'group'::text
                                            THEN catax.tax_group_id
                                            ELSE atax.tax_group_id
                                        END AS tax_group_id

                                        FROM account_tax atax
                                        JOIN account_invoice_line_tax ailts ON ailts.tax_id = atax.id
                                        LEFT JOIN account_tax_filiation_rel cataxr ON cataxr.parent_tax = atax.id
                                        LEFT JOIN account_tax catax ON catax.id = cataxr.child_tax
                                        GROUP BY atax.id,
                                            ailts.invoice_line_id,
                                            atax.amount_type,
                                            atax.tax_group_id,
                                            catax.tax_group_id) taxmin ON taxmin.a_invoice_line_id = ail.id
                                WHERE ai.state::text = ANY (ARRAY['open'::text, 'paid'::text]) AND ai.type = ANY (ARRAY['out_invoice', 'in_invoice'])
                                GROUP BY ail.id, ai.company_id,
                                    cp.state_id,
                                    ai.date_invoice, p.state_id,
                                    p.vat, ai.type, p.composition) AS ailtax
                ) AS sub
                GROUP BY sub.in_type_of_supply, sub.out_type_of_supply, sub.company_id, sub.invoice_month, sub.type)""" %(self._table, self.get_model_data('l10n_in','igst_group'),
                    self.get_model_data('l10n_in','cgst_group'),
                    self.get_model_data('l10n_in','sgst_group'),
                    'l10n_in', 'igst_sale_0',
                    'l10n_in', 'gst_sale_0',
                    'l10n_in', 'igst_purchase_0',
                    'l10n_in', 'gst_purchase_0'))

    def get_model_data(self, module, name):
        return "(SELECT res_id FROM ir_model_data WHERE module='%s' AND name='%s')"%(module, name)
