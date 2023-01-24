from odoo import models, api, fields


class StockReplenishmentInfo(models.TransientModel):

    _name = 'safety.stock.info'

    orderpoint_id = fields.Many2one('stock.warehouse.orderpoint')
    product_id = fields.Many2one('product.product', related='orderpoint_id.product_id')
    SS1 = fields.Integer(related='orderpoint_id.SS1')
