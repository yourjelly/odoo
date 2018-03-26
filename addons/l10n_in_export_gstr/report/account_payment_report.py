# -*- coding:utf-8 -*-
#az Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import tools
from odoo import api, fields, models
from odoo.tools.safe_eval import safe_eval


class AccountAdvancesPaymentReport(models.Model):

    _name = "account.advances.payment.report"
    _description = "Advances Payment Analysis"
    _auto = False
    _rec_name = 'place_of_supply'

    payment_month = fields.Char('Payment Month')
    payment_ids = fields.Char('Payment ids')
    place_of_supply = fields.Char("Place of supply")
    payment_amount = fields.Float(string="Payment Amount")
    amount = fields.Float(compute="_compute_amount" ,string="Advance Payment Amount")
    tax_rate = fields.Float(compute="_compute_tax_rate", string="Tax rate")
    company_id = fields.Integer("Company")

    def get_default_gst_rate(self):
        #Give default gst tax rate if Any GST tax select in account setting else return 18(default as per Indian GSTR guidelines).
        tax_rate_count = 18
        IrDefault = self.env['ir.default'].sudo()
        taxes_id = IrDefault.get('product.template', "taxes_id", company_id = self.env.user.company_id.id)
        if taxes_id:
            sale_tax = self.env['account.tax'].browse(taxes_id)
            if sale_tax.amount_type == 'group':
                tax_rate_count = sum(sale_tax.children_tax_ids.mapped('amount'))
            else:
                tax_rate_count = sale_tax.amount
        return tax_rate_count

    def _compute_amount(self):
        for record in self:
            amount = record.payment_amount
            for payment in  self.env['account.payment'].browse(safe_eval(record.payment_ids)):
                for invoice_id in payment.invoice_ids.filtered(lambda i: i.date_invoice <= payment.payment_date):
                    payment_move_lines  = invoice_id.payment_move_line_ids
                    if  payment.id in payment_move_lines.mapped('payment_id').ids:
                        amount -= sum([p.amount for p in payment_move_lines.matched_debit_ids if p.debit_move_id in invoice_id.move_id.line_ids])
            record.amount = amount

    @api.multi
    def _compute_tax_rate(self):
        tax_rate_count = self.get_default_gst_rate()
        for record in self:
            record.tax_rate = tax_rate_count

    @api.model_cr
    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self._cr.execute("""
            CREATE OR REPLACE VIEW %s AS (
                SELECT concat(sub.state_id, '-', sub.company_id) AS id,
                array_agg(sub.payment_id) as payment_ids,
                sub.place_of_supply,
                sum(sub.amount) as payment_amount,
                sub.payment_month as payment_month,
                sub.company_id
                FROM (
                    SELECT ap.id as payment_id,
                        to_char(ap.payment_date, 'MM-YYYY') as payment_month,
                        ap.company_id as company_id,
                        (CASE WHEN rcs.l10n_in_tin IS NOT NULL THEN concat(rcs.l10n_in_tin,'-',rcs.name) ELSE NULL END) as place_of_supply,
                        rcs.id as state_id,
                        ap.amount as amount
                        FROM account_payment ap
                        JOIN res_partner p ON p.id = ap.partner_id
                        JOIN res_country_state rcs ON  rcs.id = p.state_id
                        WHERE ap.state = ANY (ARRAY['posted','sent','reconciled']) and ap.payment_type = 'inbound' and rcs.l10n_in_tin IS NOT NULL
                        GROUP BY ap.id,
                            ap.amount,
                            ap.payment_date,
                            rcs.l10n_in_tin,
                            rcs.id,
                            rcs.name,
                            ap.company_id
                ) as sub
                GROUP BY sub.place_of_supply,
                    sub.state_id,
                    sub.payment_month,
                    sub.company_id)""" %(self._table))


class AccountAdvancesAdjustmentsReport(models.Model):

    _name = "account.advances.adjustments.report"
    _description = "Advances Payment Adjustments Analysis"
    _auto = False
    _rec_name = 'place_of_supply'

    @api.multi
    def _compute_tax_rate(self):
        tax_rate_count = self.env['account.advances.payment.report'].get_default_gst_rate()
        for record in self:
            record.tax_rate = tax_rate_count

    place_of_supply = fields.Char("Place of supply")
    payment_ids = fields.Char('Payment ids')
    invoice_payment = fields.Float(compute="_compute_invoice_payment" ,string="Advance adjustments Amount")
    invoice_month = fields.Char(string="Invoice Month")
    tax_rate = fields.Float(compute="_compute_tax_rate", string="Tax rate")
    company_id = fields.Integer("Company")

    def _compute_invoice_payment(self):
        for record in self:
            invoice_payment = 0
            for payment in  self.env['account.payment'].browse(safe_eval(record.payment_ids)):
                for invoice_id in payment.invoice_ids:
                    payment_move_lines  = invoice_id.payment_move_line_ids
                    if  payment.id in payment_move_lines.mapped('payment_id').ids:
                        invoice_payment += sum([p.amount for p in payment_move_lines.matched_debit_ids if p.debit_move_id in invoice_id.move_id.line_ids])
            record.invoice_payment = invoice_payment


    @api.model_cr
    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self._cr.execute("""
            CREATE OR REPLACE VIEW %s AS (
                SELECT concat(sub.state_id, '-', sub.company_id) AS id,
                array_agg(sub.payment_id) as payment_ids,
                sub.place_of_supply,
                sub.invoice_month,
                sub.company_id
                FROM (
                    SELECT ap.id as payment_id,
                        to_char(ai.date_invoice, 'MM-YYYY') AS invoice_month,
                        ap.company_id as company_id,
                        (CASE WHEN rcs.l10n_in_tin IS NOT NULL THEN concat(rcs.l10n_in_tin,'-',rcs.name) ELSE NULL END) as place_of_supply,
                        rcs.id as state_id
                        FROM account_invoice ai
                        JOIN account_invoice_payment_rel aipr ON aipr.invoice_id = ai.id
                        JOIN account_payment ap ON ap.id = aipr.payment_id
                        JOIN res_partner p ON p.id = ai.partner_id
                        JOIN res_country_state rcs ON  rcs.id = p.state_id
                        WHERE ai.state = ANY (ARRAY['open','paid']) and rcs.l10n_in_tin IS NOT NULL AND ai.date_invoice > ap.payment_date and ap.payment_type = 'inbound'
                        GROUP BY
                            ap.id,
                            ai.date_invoice,
                            rcs.l10n_in_tin,
                            rcs.id,
                            rcs.name,
                            ai.company_id
                ) as sub
                GROUP BY sub.place_of_supply,
                    sub.state_id,
                    sub.invoice_month,
                    sub.company_id)"""%(self._table))
