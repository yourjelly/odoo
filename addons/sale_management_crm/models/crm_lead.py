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

    def action_sale_quotations_new(self):
        if not self.partner_id:
            return self.env.ref("sale_management_crm.crm_quotation_partner_action").read()[0]
        else:
            return self.action_new_quotation()

    def action_new_quotation(self):
        action = self.env.ref("sale_management_crm.sale_action_quotations_new").read()[0]
        action['context'] = {
            'search_default_opportunity_id': self.id,
            'default_opportunity_id': self.id,
            'search_default_partner_id': self.partner_id.id,
            'default_partner_id': self.partner_id.id,
            'default_team_id': self.team_id.id,
            'default_campaign_id': self.campaign_id.id,
            'default_medium_id': self.medium_id.id,
            'default_origin': self.name,
            'default_name': self.name,
            'default_source_id': self.source_id.id,
            'default_company_id': self.company_id.id or self.env.company.id,
        }
        return action

    def action_view_sale_quotation(self):
        action = self.env.ref('sale.action_quotations_with_onboarding').read()[0]
        action['context'] = {
            'search_default_draft': 1,
            'search_default_partner_id': self.partner_id.id,
            'default_partner_id': self.partner_id.id,
            'default_opportunity_id': self.id
        }
        action['domain'] = [('opportunity_id', '=', self.id), ('state', 'in', ['draft', 'sent'])]
        quotations = self.mapped('order_ids').filtered(lambda l: l.state in ('draft', 'sent'))
        if len(quotations) == 1:
            action['views'] = [(self.env.ref('sale.view_order_form').id, 'form')]
            action['res_id'] = quotations.id
        return action

    def action_view_sale_order(self):
        action = self.env.ref('sale.action_orders').read()[0]
        action['context'] = {
            'search_default_partner_id': self.partner_id.id,
            'default_partner_id': self.partner_id.id,
            'default_opportunity_id': self.id,
        }
        action['domain'] = [('opportunity_id', '=', self.id), ('state', 'not in', ('draft', 'sent', 'cancel'))]
        orders = self.mapped('order_ids').filtered(lambda l: l.state not in ('draft', 'sent', 'cancel'))
        if len(orders) == 1:
            action['views'] = [(self.env.ref('sale.view_order_form').id, 'form')]
            action['res_id'] = orders.id
        return action
