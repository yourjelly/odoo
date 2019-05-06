from odoo import api, models, fields, tools

class StockZeroQuantityCount(models.TransientModel):
    _name = 'stock.zero.quantity.count'
    _description = 'Stock Zero Quantity Count'
    #_inherit = 'stock.inventory.quant'

    quant_line_ids = fields.Many2many('stock.quant')
