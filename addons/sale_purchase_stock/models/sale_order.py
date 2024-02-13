# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models


class SaleOrder(models.Model):
    _inherit = 'sale.order'

    @api.depends('procurement_group_id.stock_move_ids.created_purchase_line_ids.order_id', 'procurement_group_id.stock_move_ids.move_orig_ids.purchase_line_id.order_id')
    def _compute_purchase_order_count(self):
        super()._compute_purchase_order_count()

    def _get_purchase_orders(self):
        return super()._get_purchase_orders() | self.procurement_group_id.stock_move_ids.created_purchase_line_ids.order_id | self.procurement_group_id.stock_move_ids.move_orig_ids.purchase_line_id.order_id
