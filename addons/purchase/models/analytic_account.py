# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class AccountAnalyticAccount(models.Model):
    _inherit = 'account.analytic.account'

    purchase_order_line_ids = fields.One2many('purchase.order.line', 'account_analytic_id', string='Purchase Order Lines')
    purchase_order_count = fields.Integer("Purchase Order Count", compute='_compute_purchase_order_count')

    @api.depends('purchase_order_line_ids')
    def _compute_purchase_order_count(self):
        for account in self:
            account.purchase_order_count = len(self.purchase_order_line_ids.order_id)

    def action_view_purchase_orders(self):
        self.ensure_one()
        purchase_orders = self.purchase_order_line_ids.order_id
        result = {
            "type": "ir.actions.act_window",
            "res_model": "purchase.order",
            "domain": [['id', 'in', purchase_orders.ids]],
            "name": "Purchase Orders",
            'view_mode': 'tree,form',
        }
        if len(purchase_orders) == 1:
            result['view_mode'] = 'form'
            result['res_id'] = purchase_orders.id
        return result
