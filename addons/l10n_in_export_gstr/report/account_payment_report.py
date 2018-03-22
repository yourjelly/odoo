# -*- coding:utf-8 -*-
#az Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import tools
from odoo import api, fields, models

class AccountAdvancesPaymentReport(models.Model):

    _name = "account.advances.payment.report"
    _description = "Advances Payment Analysis"
    _auto = False
    _rec_name = 'place_of_supply'

    payment_month = fields.Char('Payment Month')
    place_of_supply = fields.Char("Place of supply")
    amount = fields.Float(string="Advance Payment Amount")
    internal_type = fields.Selection([('payable', 'Payable'), ('receivable', 'Receivable')], string="Internal Type")
    tax_rate = fields.Float(compute="_compute_tax_rate", string="Tax rate")
    company_id = fields.Integer("Company")

    def get_default_gst_rate(self):
        #Give default gst tax rate if Any GST tax select in account setting else return 18(default as per Indian GSTR guidelines).
        tax_rate_count = 18
        ir_values = self.env['ir.values'].sudo()
        taxes_id = ir_values.get_default('product.template', 'taxes_id', company_id = self.env.user.company_id.id)
        if taxes_id:
            sale_tax = self.env['account.tax'].browse(taxes_id)
            if sale_tax.amount_type == 'group':
                tax_rate_count = sum(sale_tax.children_tax_ids.mapped('amount'))
            else:
                tax_rate_count = sale_tax.amount
        return tax_rate_count

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
                SELECT sub.state_id AS id,
                sub.place_of_supply,
                sub.internal_type,
                sum(sub.amount) as amount,
                sub.payment_month as payment_month,
                sub.company_id
                FROM (
                    SELECT
                        to_char(ap.payment_date, 'MM-YYYY') as payment_month,
                        ap.company_id as company_id,
                        (CASE WHEN rcs.x_tin IS NOT NULL THEN concat(rcs.x_tin,'-',rcs.name) ELSE NULL END) as place_of_supply,
                        rcs.id as state_id,
                        ap.amount - sum(paml.invoice_paid_amount) as amount,
                        paml.internal_type as internal_type
                        FROM account_payment ap
                        JOIN res_partner p ON p.id = ap.partner_id
                        LEFT JOIN res_country_state rcs ON  rcs.id = p.state_id

                        JOIN (select CASE WHEN ai.date_invoice <= app.payment_date then sum(apr.amount) else 0 END as invoice_paid_amount,
                                app.id as payment_id,
                                acc.internal_type as internal_type
                                from account_move_line aml
                            JOIN account_account acc ON acc.id = aml.account_id AND acc.internal_type IN ('payable', 'receivable')
                            JOIN account_payment app ON app.id = aml.payment_id
                            LEFT JOIN account_partial_reconcile apr
                                ON CASE WHEN  acc.internal_type = 'receivable'
                                    THEN
                                        apr.credit_move_id = aml.id
                                    ELSE
                                        apr.debit_move_id = aml.id
                                    END
                            LEFT JOIN account_move_line ai_aml
                                ON CASE WHEN  acc.internal_type = 'receivable'
                                    THEN
                                        ai_aml.id = apr.debit_move_id
                                    ELSE
                                        ai_aml.id = apr.credit_move_id
                                    END
                            LEFT JOIN account_invoice ai
                                ON ai.id = ai_aml.invoice_id
                                group by acc.internal_type, app.id ,ai.date_invoice, app.payment_date) as paml
                                    ON paml.payment_id = ap.id
                        WHERE ap.state = ANY (ARRAY['posted','sent','reconciled']) and ap.payment_type = 'inbound' and rcs.x_tin IS NOT NULL
                        GROUP BY
                            ap.amount,
                            ap.payment_date,
                            rcs.x_tin,
                            rcs.id,
                            rcs.name,
                            paml.internal_type,
                            ap.company_id
                ) as sub
                GROUP BY sub.place_of_supply,
                    sub.state_id,
                    sub.payment_month,
                    sub.internal_type,
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
    invoice_payment = fields.Float(string="Advance Payment Amount")
    invoice_month = fields.Char(string="Invoice Month")
    internal_type = fields.Selection([('payable', 'Payable'), ('receivable', 'Receivable')], string="Internal Type")
    tax_rate = fields.Float(compute="_compute_tax_rate", string="Tax rate")
    company_id = fields.Integer("Company")

    @api.model_cr
    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self._cr.execute("""
            CREATE OR REPLACE VIEW %s AS (
                SELECT sub.state_id AS id,
                sub.place_of_supply,
                sub.internal_type,
                sum(sub.invoice_payment) as invoice_payment,
                sub.invoice_month,
                sub.company_id
                FROM (
                    SELECT
                        paml.invoice_month,
                        ap.company_id as company_id,
                        (CASE WHEN rcs.x_tin IS NOT NULL THEN concat(rcs.x_tin,'-',rcs.name) ELSE NULL END) as place_of_supply,
                        rcs.id as state_id,
                        sum(paml.invoice_paid_amount) as invoice_payment,
                        paml.internal_type as internal_type
                        FROM account_payment ap
                        JOIN res_partner p ON p.id = ap.partner_id
                        LEFT JOIN res_country_state rcs ON  rcs.id = p.state_id
                        JOIN (select CASE WHEN ai.date_invoice > app.payment_date then sum(apr.amount) else 0 END as invoice_paid_amount,
                                app.id as payment_id,
                                acc.internal_type as internal_type,
                                to_char(ai.date_invoice, 'MM-YYYY') as invoice_month
                                from account_move_line aml
                                JOIN account_account acc ON acc.id = aml.account_id AND acc.internal_type IN ('payable', 'receivable')
                                JOIN account_payment app ON app.id = aml.payment_id
                                LEFT JOIN account_partial_reconcile apr
                                    ON CASE WHEN  acc.internal_type = 'receivable'
                                        THEN
                                            apr.credit_move_id = aml.id
                                        ELSE
                                            apr.debit_move_id = aml.id
                                        END
                                LEFT JOIN account_move_line ai_aml
                                    ON CASE WHEN  acc.internal_type = 'receivable'
                                        THEN
                                            ai_aml.id = apr.debit_move_id
                                        ELSE
                                            ai_aml.id = apr.credit_move_id
                                        END
                                LEFT JOIN account_invoice ai ON ai.id = ai_aml.invoice_id
                                where ai.date_invoice IS NOT NULL
                                group by acc.internal_type, app.id ,ai.date_invoice, app.payment_date) as paml ON paml.payment_id = ap.id
                        WHERE ap.state = ANY (ARRAY['posted','sent','reconciled']) and ap.payment_type = 'inbound' and rcs.x_tin IS NOT NULL
                        GROUP BY
                            ap.amount,
                            rcs.x_tin,
                            rcs.id,
                            rcs.name,
                            paml.internal_type,
                            ap.company_id,
                            paml.invoice_month
                ) as sub
                GROUP BY sub.place_of_supply,
                    sub.state_id,
                    sub.invoice_month,
                    sub.internal_type,
                    sub.company_id)"""%(self._table))
