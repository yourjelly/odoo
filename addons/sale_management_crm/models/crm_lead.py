# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from dateutil.relativedelta import relativedelta

from odoo import api, fields, models


class CrmLead(models.Model):
    _inherit = 'crm.lead'

    @api.model
    def retrieve_sales_dashboard(self):
        res = super(CrmLead, self).retrieve_sales_dashboard()
        date_today = fields.Date.from_string(fields.Date.context_today(self))

        res['invoiced'] = {
            'this_month': 0,
            'last_month': 0,
        }
        account_invoice_domain = [
            ('state', '=', 'posted'),
            ('invoice_user_id', '=', self.env.uid),
            ('invoice_date', '>=', date_today.replace(day=1) - relativedelta(months=+1)),
            ('type', 'in', ['out_invoice', 'out_refund'])
        ]

        invoice_data = self.env['account.move'].search_read(account_invoice_domain, ['invoice_date', 'amount_untaxed', 'type'])

        for invoice in invoice_data:
            if invoice['invoice_date']:
                invoice_date = fields.Date.from_string(invoice['invoice_date'])
                sign = 1 if invoice['type'] == 'out_invoice' else -1
                if invoice_date <= date_today and invoice_date >= date_today.replace(day=1):
                    res['invoiced']['this_month'] += sign * invoice['amount_untaxed']
                elif invoice_date < date_today.replace(day=1) and invoice_date >= date_today.replace(day=1) - relativedelta(months=+1):
                    res['invoiced']['last_month'] += sign * invoice['amount_untaxed']

        res['invoiced']['target'] = self.env.user.target_sales_invoiced
        return res

    def action_new_quotation(self):
        res = super(CrmLead, self).action_new_quotation()
        action = self.env.ref("sale_management_crm.sale_action_quotations_new").read()[0]
        action.update(res)
        return action

    def action_view_sale_quotation(self):
        res = super(CrmLead, self).action_view_sale_quotation()
        action = self.env.ref('sale.action_quotations_with_onboarding').read()[0]
        action.update(res)
        if len(action['quotations']) == 1:
            action['views'] = [(self.env.ref('sale.view_order_form').id, 'form')]
            action['res_id'] = action['quotations'].id
        return action

    def action_view_sale_order(self):
        res = super(CrmLead, self).action_view_sale_order()
        action = self.env.ref('sale.action_orders').read()[0]
        action.update(res)
        if len(action['orders']) == 1:
            action['views'] = [(self.env.ref('sale.view_order_form').id, 'form')]
            action['res_id'] = action['orders'].id
        return action
