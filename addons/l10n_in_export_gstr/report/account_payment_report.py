# -*- coding:utf-8 -*-
#az Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import tools
from odoo import api, fields, models
from odoo.tools.safe_eval import safe_eval


class AccountAdvancesPaymentReport(models.Model):

    _name = "account.advances.payment.report"
    _inherit = "account.generic.gst.report"
    _description = "Advances Payment Analysis"
    _auto = False
    _rec_name = 'place_of_supply'

    payment_month = fields.Char('Payment Month')
    payment_ids = fields.Char('Payment ids')
    place_of_supply = fields.Char("Place of supply")
    payment_amount = fields.Float(string="Payment Amount", digits= (16,2))
    amount = fields.Float(compute="_compute_amount" ,string="Advance Payment Amount", digits= (16,2))
    tax_rate = fields.Float(compute="_compute_tax", string="Tax rate")
    igst_amount = fields.Float(compute="_compute_tax", string="IGST amount", digits= (16,2))
    cgst_amount = fields.Float(compute="_compute_tax", string="CGST amount", digits= (16,2))
    sgst_amount = fields.Float(compute="_compute_tax", string="SGST amount", digits= (16,2))
    company_id = fields.Integer("Company")
    payment_type = fields.Selection([('outbound', 'Send Money'), ('inbound', 'Receive Money')], string='Payment Type')
    supply_type = fields.Selection([('inter_state', 'Inter State'), ('intra_state', 'Intra State')], string="Supply Type")

    def _compute_amount(self):
        for record in self:
            amount = record.payment_amount
            for payment in  self.env['account.payment'].browse(safe_eval(record.payment_ids)):
                for invoice in payment.invoice_ids.filtered(lambda i: i.date_invoice <= payment.payment_date):
                    amount -= self._get_related_payment(invoice, payment)
            record.amount = amount

    def _compute_tax(self):
        default_sale_gst_rate = self._get_default_gst_rate('sale')
        default_purchase_gst_rate = self._get_default_gst_rate('purchase')
        for record in self:
            tax_rate_count = default_purchase_gst_rate if record.supply_type == 'outbound' else default_sale_gst_rate
            tax_amount = record.amount * (tax_rate_count / 100)
            record.igst_amount = record.supply_type == 'inter_state' and tax_amount or 0
            record.cgst_amount = record.supply_type == 'intra_state' and tax_amount/2 or 0
            record.sgst_amount = record.supply_type == 'intra_state' and tax_amount/2 or 0
            record.tax_rate = tax_rate_count

    @api.model_cr
    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self._cr.execute("""
            CREATE OR REPLACE VIEW %s AS (
                SELECT array_agg(sub.payment_id)::text AS id,
                array_agg(sub.payment_id) AS payment_ids,
                sub.place_of_supply,
                SUM(sub.amount) AS payment_amount,
                sub.payment_month AS payment_month,
                sub.company_id,
                sub.payment_type,
                sub.supply_type
                FROM (
                    SELECT ap.id AS payment_id,
                        to_char(ap.payment_date, 'MM-YYYY') AS payment_month,
                        aj.company_id AS company_id,
                        ap.amount AS amount,
                        ap.payment_type,
                        (CASE WHEN p.state_id = cp.state_id THEN 'intra_state' ELSE 'inter_state' END) AS supply_type,
                        (CASE WHEN ap.payment_type = 'inbound' AND ps.l10n_in_tin IS NOT NULL THEN concat(ps.l10n_in_tin,'-',ps.name)
                            WHEN ap.payment_type = 'outbound' AND cps.l10n_in_tin IS NOT NULL THEN concat(cps.l10n_in_tin,'-',cps.name)
                            ELSE NULL END) AS place_of_supply
                        FROM account_payment ap
                        JOIN account_journal aj ON aj.id = ap.journal_id
                        JOIN res_company apc ON apc.id = aj.company_id
                        JOIN res_partner cp ON cp.id = apc.partner_id
                        JOIN res_country_state cps ON  cps.id = cp.state_id
                        JOIN res_partner p ON p.id = ap.partner_id
                        JOIN res_country_state ps ON  ps.id = p.state_id
                        WHERE ap.state = ANY (ARRAY['posted','sent','reconciled']) AND ap.payment_type = ANY(ARRAY['inbound', 'outbound']) AND ps.l10n_in_tin IS NOT NULL
                        GROUP BY ap.id,
                            ap.amount,
                            ap.payment_date,
                            ps.l10n_in_tin,
                            ps.id,
                            ps.name,
                            aj.company_id,
                            cp.state_id,
                            p.state_id,
                            ap.payment_type,
                            cps.l10n_in_tin,
                            cps.name
                ) AS sub
                GROUP BY sub.place_of_supply,
                    sub.payment_month,
                    sub.company_id,
                    sub.payment_type,
                    sub.supply_type)""" %(self._table))


class AccountAdvancesAdjustmentsReport(models.Model):

    _name = "account.advances.adjustments.report"
    _inherit = "account.generic.gst.report"
    _description = "Advances Payment Adjustments Analysis"
    _auto = False
    _rec_name = 'place_of_supply'

    place_of_supply = fields.Char("Place of supply")
    payment_ids = fields.Char('Payment ids')
    invoice_payment = fields.Float(compute="_compute_invoice_payment" ,string="Advance adjustments Amount")
    invoice_month = fields.Char(string="Invoice Month")
    tax_rate = fields.Float(compute="_compute_tax", string="Tax rate")
    igst_amount = fields.Float(compute="_compute_tax", string="IGST amount", digits= (16,2))
    cgst_amount = fields.Float(compute="_compute_tax", string="CGST amount", digits= (16,2))
    sgst_amount = fields.Float(compute="_compute_tax", string="SGST amount", digits= (16,2))
    company_id = fields.Integer("Company")
    payment_type = fields.Selection([('outbound', 'Send Money'), ('inbound', 'Receive Money')], string='Payment Type')
    supply_type = fields.Selection([('inter_state', 'Inter State'), ('intra_state', 'Intra State')], string="Supply Type")

    def _compute_tax(self):
        default_sale_gst_rate = self._get_default_gst_rate('sale')
        default_purchase_gst_rate = self._get_default_gst_rate('purchase')
        for record in self:
            tax_rate_count = default_purchase_gst_rate if record.supply_type == 'outbound' else default_sale_gst_rate
            tax_amount = record.invoice_payment * (tax_rate_count / 100)
            record.igst_amount = record.supply_type == 'inter_state' and tax_amount or 0
            record.cgst_amount = record.supply_type == 'intra_state' and tax_amount/2 or 0
            record.sgst_amount = record.supply_type == 'intra_state' and tax_amount/2 or 0
            record.tax_rate = tax_rate_count

    def _compute_invoice_payment(self):
        for record in self:
            invoice_payment = 0
            for payment in  self.env['account.payment'].browse(safe_eval(record.payment_ids)):
                for invoice in payment.invoice_ids:
                    invoice_payment += self._get_related_payment(invoice, payment)
            record.invoice_payment = invoice_payment


    @api.model_cr
    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self._cr.execute("""
            CREATE OR REPLACE VIEW %s AS (
                SELECT concat(sub.supply_type, '-', sub.place_of_supply, '-', sub.company_id, '-', sub.invoice_month, '-', sub.payment_type) AS id,
                array_agg(sub.payment_id) AS payment_ids,
                sub.place_of_supply,
                sub.invoice_month,
                sub.company_id,
                sub.payment_type,
                sub.supply_type
                FROM (
                    SELECT ap.id AS payment_id,
                        to_char(ai.date_invoice, 'MM-YYYY') AS invoice_month,
                        aj.company_id AS company_id,
                        (CASE WHEN ap.payment_type = 'inbound' AND ps.l10n_in_tin IS NOT NULL THEN concat(ps.l10n_in_tin,'-',ps.name)
                            WHEN ap.payment_type = 'outbound' AND cps.l10n_in_tin IS NOT NULL THEN concat(cps.l10n_in_tin,'-',cps.name)
                            ELSE NULL END) AS place_of_supply,
                        (CASE WHEN p.state_id = cp.state_id THEN 'intra_state' ELSE 'inter_state' END) AS supply_type,
                        ps.id AS state_id,
                        ap.payment_type AS payment_type
                        FROM account_invoice ai
                            JOIN account_invoice_payment_rel aipr ON aipr.invoice_id = ai.id
                            JOIN account_payment ap ON ap.id = aipr.payment_id
                            JOIN account_journal aj ON aj.id = ap.journal_id
                            JOIN res_company apc ON apc.id = aj.company_id
                            JOIN res_partner cp ON cp.id = apc.partner_id
                            JOIN res_country_state cps ON  cps.id = cp.state_id
                            JOIN res_partner p ON p.id = ai.partner_id
                            JOIN res_country_state ps ON  ps.id = p.state_id
                        WHERE ai.state = ANY (ARRAY['open','paid']) AND ps.l10n_in_tin IS NOT NULL
                            AND ai.date_invoice > ap.payment_date AND ap.payment_type = ANY(ARRAY['inbound', 'outbound'])
                        GROUP BY
                            ap.id,
                            ap.payment_type,
                            ai.date_invoice,
                            ps.l10n_in_tin,
                            ps.id,
                            ps.name,
                            aj.company_id,
                            p.state_id,
                            cp.state_id,
                            cps.l10n_in_tin,
                            cps.name
                ) AS sub
                GROUP BY sub.place_of_supply,
                    sub.invoice_month,
                    sub.company_id,
                    sub.payment_type,
                    sub.supply_type)"""%(self._table))
