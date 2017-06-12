# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests.common import TransactionCase


class TestInventory(TransactionCase):
    def setUp(self):
        super(TestInventory, self).setUp()
        self.stock_location = self.env.ref('stock.stock_location_stock')
        self.uom_unit = self.env.ref('product.product_uom_unit')
        self.product1 = self.env['product.product'].create({
            'name': 'Product A',
            'type': 'product',
            'categ_id': self.env.ref('product.product_category_all').id,
        })

    def test_inventory_1(self):
        """ Check that making an inventory adjustment to remove all products from stock is working
        as expected.
        """
        # make some stock
        self.env['stock.quant'].increase_available_quantity(self.product1, self.stock_location, 100)
        self.assertEqual(len(self.env['stock.quant']._gather(self.product1, self.stock_location)), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 100.0)

        # remove them with an inventory adjustment
        inventory = self.env['stock.inventory'].create({
            'name': 'remove product1',
            'filter': 'product',
            'location_id': self.stock_location.id,
            'product_id': self.product1.id,
        })
        inventory.prepare_inventory()
        self.assertEqual(len(inventory.line_ids), 1)
        self.assertEqual(inventory.line_ids.theoretical_qty, 100)
        inventory.line_ids.product_qty = 0  # Put the quantity back to 0
        inventory.action_done()

        # check
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 0.0)
        self.assertEqual(len(self.env['stock.quant']._gather(self.product1, self.stock_location)), 0.0)
