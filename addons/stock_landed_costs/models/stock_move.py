from odoo import models


class StockMove(models.Model):
    _inherit = "stock.move"

    def get_stock_valuation_layer_ids(self):
        return self.stock_valuation_layer_ids
