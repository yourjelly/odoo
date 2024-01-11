# -*- coding: utf-8 -*-

from odoo import api, fields, models, _


class AccountAnalyticAccount(models.Model):
    _inherit = 'account.analytic.account'

    invoice_count = fields.Integer(
        "Invoice Count",
        compute='_compute_invoice_count',
    )
    vendor_bill_count = fields.Integer(
        "Vendor Bill Count",
        compute='_compute_vendor_bill_count',
    )

    @api.depends('line_ids')
    def _compute_invoice_count(self):
        sale_types = self.env['account.move'].get_sale_types(include_receipts=True)
        move_line_query = self.env['account.move.line']._search([
            ('parent_state', '=', 'posted'),
            ('move_id.move_type', 'in', sale_types),
        ])
        for plan, accounts in self.grouped('plan_id'):
            data = dict(self.env['account.analytic.line']._read_group(
                domain=[('move_line_id', 'in', move_line_query)],
                aggregates=['__count'],
                groupby=[plan._column_name()]
            ))
            for account in accounts:
                account.invoice_count = data.get(account, 0)

    @api.depends('line_ids')
    def _compute_vendor_bill_count(self):
        purchase_types = self.env['account.move'].get_purchase_types(include_receipts=True)
        move_line_query = self.env['account.move.line']._search([
            ('parent_state', '=', 'posted'),
            ('move_id.move_type', 'in', purchase_types),
        ])
        for plan, accounts in self.grouped('plan_id'):
            data = dict(self.env['account.analytic.line']._read_group(
                domain=[('move_line_id', 'in', move_line_query)],
                aggregates=['__count'],
                groupby=[plan._column_name()]
            ))
            for account in accounts:
                account.vendor_bill_count = data.get(account, 0)

    def action_view_invoice(self):
        self.ensure_one()
        plan_field = self.plan_id._column_name()
        return {
            "type": "ir.actions.act_window",
            "res_model": "account.move",
            "domain": [
                (f'line_ids.analytic_line_ids.{plan_field}', '=', self.id),
                ('move_type', 'in', self.env['account.move'].get_sale_types())
            ],
            "context": {"create": False, 'default_move_type': 'out_invoice'},
            "name": _("Customer Invoices"),
            'view_mode': 'tree,form',
        }

    def action_view_vendor_bill(self):
        self.ensure_one()
        plan_field = self.plan_id._column_name()
        return {
            "type": "ir.actions.act_window",
            "res_model": "account.move",
            "domain": [
                (f'line_ids.analytic_line_ids.{plan_field}', '=', self.id),
                ('move_type', 'in', self.env['account.move'].get_purchase_types())
            ],
            "context": {"create": False, 'default_move_type': 'in_invoice'},
            "name": _("Vendor Bills"),
            'view_mode': 'tree,form',
        }
