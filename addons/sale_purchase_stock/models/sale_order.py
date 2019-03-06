# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _


class SaleOrder(models.Model):
    _inherit = 'sale.order'

    purchase_ids = fields.Many2many('purchase.order', string="Purchase Orders")
    purchase_count = fields.Integer(string="Number of linked Purchase Order",
        compute='_compute_purchase_count')

    def action_view_purchase(self):
        purchase_orders = self.mapped('purchase_ids')
        action = self.env.ref('purchase.purchase_rfq').read()[0]
        if len(purchase_orders) > 1:
            action['domain'] = [('id', 'in', purchase_orders.ids)]
        elif len(purchase_orders) == 1:
            action['views'] = [(self.env.ref('purchase.purchase_order_form').id, 'form')]
            action['res_id'] = purchase_orders.ids[0]
        else:
            action = {'type': 'ir.actions.act_window_close'}
        return action

    @api.depends('purchase_ids')
    def _compute_purchase_count(self):
        for order in self:
            order.purchase_count = len(order.purchase_ids)


class StockMove(models.Model):
    _inherit = 'stock.move'

    def _prepare_procurement_values(self):
        res = super(StockMove, self)._prepare_procurement_values()
        if self.group_id.sale_id:
            res['sale_ids'] = [(4, self.group_id.sale_id.id, None)]
        return res


class StockRule(models.Model):
    _inherit = 'stock.rule'

    def _prepare_purchase_order(self, company_id, origins, values):
        res = super(StockRule, self)._prepare_purchase_order(company_id, origins, values)
        sale_ids = values[0].get('sale_ids')
        if sale_ids:
            res['sale_ids'] = sale_ids
        return res
