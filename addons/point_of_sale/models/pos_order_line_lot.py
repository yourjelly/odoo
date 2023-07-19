# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import api, fields, models, tools, _


class PosOrderLineLot(models.Model):
    _name = "pos.pack.operation.lot"
    _description = "Specify product lot/serial number in pos order line"
    _rec_name = "lot_name"

    pos_order_line_id = fields.Many2one('pos.order.line')
    order_id = fields.Many2one('pos.order', related="pos_order_line_id.order_id", readonly=False)
    lot_name = fields.Char('Lot Name')
    product_id = fields.Many2one('product.product', related='pos_order_line_id.product_id', readonly=False)

    def _export_for_ui(self, lot):
        return {
            'lot_name': lot.lot_name,
        }

    def export_for_ui(self):
        return self.mapped(self._export_for_ui) if self else []
