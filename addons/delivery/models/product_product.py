# -*- coding: utf-8 -*-
from odoo import models


class ProductProduct(models.Model):
    _inherit = 'product.product'

    def _write_sale_order_line(self, sale_order, sale_order_line):
        sale_order.write({'recompute_delivery_price': True})
        super()._write_sale_order_line(sale_order, sale_order_line)
