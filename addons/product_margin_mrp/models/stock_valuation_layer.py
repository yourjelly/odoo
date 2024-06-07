from odoo import api, fields, models


class StockValuationLayer(models.Model):

    _inherit = 'stock.valuation.layer'

    so_unit_price = fields.Float('SO Unit Price', compute='_compute_so_unit_price', readonly=True, store=True)
    turnover = fields.Float(compute='_compute_so_unit_price', string='Turnover', readonly=True, store=True)
    total_margin = fields.Float(compute='_compute_so_unit_price', string='Total Margin', readonly=True, store=True)

    @api.depends('stock_move_id')
    def _compute_so_unit_price(self):
        for line in self:
            try:
                if line.stock_move_id and line.stock_move_id.sale_line_id and line.stock_move_id.sale_line_id.price_unit:
                    line.so_unit_price = line.stock_move_id.sale_line_id.price_unit
                else:
                    line.so_unit_price = 0
            except AttributeError:
                line.so_unit_price = 0
            line.turnover = line.so_unit_price * abs(line.quantity) or 0
            line.total_margin = line.turnover - abs(line.value) or 0
