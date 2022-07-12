# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class SaleOrder(models.Model):
    _inherit = 'sale.order'

    def _get_purchase_orders(self):
        return super()._get_purchase_orders()\
            | self.procurement_group_id.stock_move_ids.created_purchase_line_id.order_id\
            | self.procurement_group_id.stock_move_ids.move_orig_ids.purchase_line_id.order_id
