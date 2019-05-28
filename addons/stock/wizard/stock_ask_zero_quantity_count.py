from odoo import api, models, fields, tools

class StockZeroQuantityCountQuestion(models.TransientModel):
    _name = 'stock.ask.zero.quantity.count'
    _description = 'Stock Ask Zero Quantity Count'

    def action_zero_quantity_count_question(self):
        return
