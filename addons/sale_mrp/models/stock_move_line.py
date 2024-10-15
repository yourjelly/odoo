# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models
from odoo.addons import sale_stock, mrp


class StockMoveLine(mrp.StockMoveLine, sale_stock.StockMoveLine):

    def _compute_sale_price(self):
        kit_lines = self.filtered(lambda move_line: move_line.move_id.bom_line_id.bom_id.type == 'phantom')
        for move_line in kit_lines:
            unit_price = move_line.product_id.list_price
            qty = move_line.product_uom_id._compute_quantity(move_line.quantity, move_line.product_id.uom_id)
            move_line.sale_price = unit_price * qty
        super(StockMoveLine, self - kit_lines)._compute_sale_price()
