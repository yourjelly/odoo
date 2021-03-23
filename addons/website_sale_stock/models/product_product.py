# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models
from odoo.addons.website.models import ir_http


class ProductProduct(models.Model):
    _inherit = 'product.product'

    cart_qty = fields.Integer(compute='_compute_cart_qty')

    def _compute_cart_qty(self):
        website = ir_http.get_request_website()
        if not website:
            self.cart_qty = 0
            return
        cart = website.sale_get_order()
        for product in self:
            product.cart_qty = sum(cart.order_line.filtered(lambda p: p.product_id.id == product.id).mapped('product_uom_qty')) if cart else 0

    def _get_next_incoming_move_date(self):
        domains = self._get_domain_locations()
        domain_move_in = [('product_id', '=', self.id), ('state', 'in', ('waiting', 'confirmed', 'assigned', 'partially_available'))] + domains[1]
        move = self.env['stock.move'].search(domain_move_in)
        return move[0].date if move else False
