# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class SaleOrder(models.Model):
    _name = 'sale.order'
    _inherit = ['sale.order', 'barcodes.barcode_events_mixin']

    def on_barcode_scanned(self, barcode):
        product = self.env['product.product'].search(['|', ('barcode', '=', barcode), ('default_code', '=', barcode)], limit=1)
        if not product:
            return
        existing_lines = self.order_line.filtered(lambda l: l.product_id == product)
        if existing_lines:
            existing_lines[-1].product_uom_qty += 1
        else:
            self.order_line += self.env['sale.order.line'].new({'product_id': product.id})
