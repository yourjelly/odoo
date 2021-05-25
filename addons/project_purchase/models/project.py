# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class Project(models.Model):
    _inherit = "project.project"

    purchase_order_count = fields.Integer(related="analytic_account_id.purchase_order_count")

    def action_view_purchase_orders(self):
        self.ensure_one()
        purchase_orders = self.env['purchase.order.line'].search([('account_analytic_id', '=', self.analytic_account_id.id)]).order_id
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
