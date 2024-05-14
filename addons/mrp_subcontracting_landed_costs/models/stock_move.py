from odoo import models
from odoo.tools import OrderedSet


class StockMove(models.Model):
    _inherit = "stock.move"

    def _get_in_move_lines(self):
        stock_move_lines = super()._get_in_move_lines()
        additional_move_lines = OrderedSet()
        for move_line in self.move_line_ids:
            if move_line.move_id.is_subcontract:
                additional_move_lines.add(move_line.id)
        return stock_move_lines | self.env['stock.move.line'].browse(additional_move_lines)
