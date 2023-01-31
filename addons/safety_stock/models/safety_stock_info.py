from odoo import models, api, fields


class StockReplenishmentInfo(models.TransientModel):

    _name = 'safety.stock.info'

    orderpoint_id = fields.Many2one('stock.warehouse.orderpoint')
    product_id = fields.Many2one('product.product', related='orderpoint_id.product_id')

    SS1 = fields.Integer(related='orderpoint_id.SS1')
    SS2 = fields.Integer(related='orderpoint_id.SS2')

    mean_sales = fields.Integer(related='orderpoint_id.mean_sales')
    mean_lead_time = fields.Integer(related='orderpoint_id.mean_lead_time')