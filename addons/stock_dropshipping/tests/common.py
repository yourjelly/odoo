# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests import common


class TestStock(common.TransactionCase):

    def setUp(self):
        super(TestStock, self).setUp()

        self.Procurement = self.env['procurement.order']

        """ Creating a product with no supplier define for it."""
        self.product_with_no_seller = self.env['product.product'].create({
            'name': 'product with no seller',
            'list_price': 20.0,
            'standard_price': 15.00,
            'categ_id': self.env.ref('product.product_category_1').id})

        """ Creating a sales order with this product with route dropship."""
        self.sale_order_route_dropship01 = self.env['sale.order'].create({
            'partner_id': self.env.ref('base.res_partner_2').id,
            'partner_invoice_id': self.env.ref('base.res_partner_address_3').id,
            'partner_shipping_id': self.env.ref('base.res_partner_address_3').id,
            'note': 'crossdock route',
            'payment_term_id': self.env.ref('account.account_payment_term').id,
            'order_line': [(0, 0, {'product_id': self.product_with_no_seller.id, 'product_uom': self.product_with_no_seller.uom_id.id, 'product_uom_qty': 1, 'route_id': self.env.ref('stock_dropshipping.route_drop_shipping').id})]
            })
