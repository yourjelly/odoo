# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _

class SaleOrderLine(models.Model):
    _name = 'sale.order.line'
    _inherit='sale.order.line'

    price_excluding_discount = fields.Float(string="Unit Price",
        compute='_compute_price_excluding_discount',
        store=True)

    @api.depends('price_unit', 'discount', 'product_uom_qty')
    def _compute_price_excluding_discount(self):
        for record in self:
            final_discount = record.price_unit * (record.discount / 100)
            record.price_excluding_discount = record.price_unit - final_discount