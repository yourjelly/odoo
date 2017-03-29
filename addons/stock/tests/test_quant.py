# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests.common import TransactionCase


class StockQuant(TransactionCase):
    at_install = False
    post_install = True

    def test_get_available_quantity_1(self):
        """ Quantity availability with only one quant in a location.
        """
        stock_location = self.env.ref('stock.stock_location_stock')
        product1 = self.env['product.product'].create({
            'name': 'Product A',
            'type': 'product',
        })
        self.env['stock.quant'].create({
            'product_id': product1.id,
            'location_id': stock_location.id,
            'quantity': 1.0,
        })
        self.assertEqual(self.env['stock.quant'].get_available_quantity(product1, stock_location), 1.0)

    def test_get_available_quantity_2(self):
        """ Quantity availability with multiple quants in a location.
        """
        stock_location = self.env.ref('stock.stock_location_stock')
        product1 = self.env['product.product'].create({
            'name': 'Product A',
            'type': 'product',
        })
        for i in xrange(3):
            self.env['stock.quant'].create({
                'product_id': product1.id,
                'location_id': stock_location.id,
                'quantity': 1.0,
            })
        self.assertEqual(self.env['stock.quant'].get_available_quantity(product1, stock_location), 3.0)

    def test_get_available_quantity_3(self):
        """ Quantity availability with multiple quants (including negatives ones) in a location.
        """
        stock_location = self.env.ref('stock.stock_location_stock')
        product1 = self.env['product.product'].create({
            'name': 'Product A',
            'type': 'product',
        })
        for i in xrange(3):
            self.env['stock.quant'].create({
                'product_id': product1.id,
                'location_id': stock_location.id,
                'quantity': 1.0,
            })
        self.env['stock.quant'].create({
            'product_id': product1.id,
            'location_id': stock_location.id,
            'quantity': -3.0,
        })
        self.assertEqual(self.env['stock.quant'].get_available_quantity(product1, stock_location), 0.0)

    def test_get_available_quantity_4(self):
        """ Quantity availability with no quants in a location.
        """
        stock_location = self.env.ref('stock.stock_location_stock')
        product1 = self.env['product.product'].create({
            'name': 'Product A',
            'type': 'product',
        })
        self.assertEqual(self.env['stock.quant'].get_available_quantity(product1, stock_location), 0.0)

    def test_get_available_quantity_5(self):
        """ Quantity availability with multiple partially reserved quants in a location.
        """
        stock_location = self.env.ref('stock.stock_location_stock')
        product1 = self.env['product.product'].create({
            'name': 'Product A',
            'type': 'product',
        })
        self.env['stock.quant'].create({
            'product_id': product1.id,
            'location_id': stock_location.id,
            'quantity': 10.0,
            'reserved_quantity': 9.0,
        })
        self.env['stock.quant'].create({
            'product_id': product1.id,
            'location_id': stock_location.id,
            'quantity': 1.0,
            'reserved_quantity': 1.0,
        })
        self.assertEqual(self.env['stock.quant'].get_available_quantity(product1, stock_location), 1.0)

    def test_get_available_quantity_6(self):
        """ Quantity availability with multiple partially reserved quants in a location.
        """
        stock_location = self.env.ref('stock.stock_location_stock')
        product1 = self.env['product.product'].create({
            'name': 'Product A',
            'type': 'product',
        })
        self.env['stock.quant'].create({
            'product_id': product1.id,
            'location_id': stock_location.id,
            'quantity': 10.0,
            'reserved_quantity': 20.0,
        })
        self.env['stock.quant'].create({
            'product_id': product1.id,
            'location_id': stock_location.id,
            'quantity': 5.0,
            'reserved_quantity': 0.0,
        })
        self.assertEqual(self.env['stock.quant'].get_available_quantity(product1, stock_location), -5.0)

    def test_increase_available_quantity_1(self):
        """ Increase the available quantity when no quants are already in a location.
        """
        stock_location = self.env.ref('stock.stock_location_stock')
        product1 = self.env['product.product'].create({
            'name': 'Product A',
            'type': 'product',
        })
        self.env['stock.quant'].increase_available_quantity(product1, stock_location, 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(product1, stock_location), 1.0)

    def test_increase_available_quantity_2(self):
        """ Increase the available quantity when multiple quants are already in a location.
        """
        stock_location = self.env.ref('stock.stock_location_stock')
        product1 = self.env['product.product'].create({
            'name': 'Product A',
            'type': 'product',
        })
        for i in xrange(2):
            self.env['stock.quant'].create({
                'product_id': product1.id,
                'location_id': stock_location.id,
                'quantity': 1.0,
            })
        self.assertEqual(self.env['stock.quant'].get_available_quantity(product1, stock_location), 2.0)
        self.assertEqual(len(self.env['stock.quant']._gather(product1, stock_location)), 2)
        self.env['stock.quant'].increase_available_quantity(product1, stock_location, 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(product1, stock_location), 3.0)
        self.assertEqual(len(self.env['stock.quant']._gather(product1, stock_location)), 2)

    def test_increase_available_quantity_3(self):
        """ Increase the available quantity when a concurrent transaction is already increasing
        the reserved quanntity for the same product.
        """
        stock_location = self.env.ref('stock.stock_location_stock')
        product = self.env.ref('product.product_product_12')
        self.assertEqual(self.env['stock.quant'].get_available_quantity(product, stock_location), 10.0)
        quants = self.env['stock.quant']._gather(product, stock_location)
        self.assertEqual(len(quants), 1)

        # opens a new cursor and SELECT FOR UPDATE the quant, to simulate another concurrent reserved
        # quantity increase
        cr2 = self.registry.cursor()
        cr2.execute("SELECT 1 FROM stock_quant WHERE id = %s FOR UPDATE", quants.ids)
        self.env['stock.quant'].increase_available_quantity(product, stock_location, 1.0)
        cr2.rollback()
        cr2.close()
        self.assertEqual(self.env['stock.quant'].get_available_quantity(product, stock_location), 11.0)
        self.assertEqual(len(self.env['stock.quant']._gather(product, stock_location)), 2)

    def test_decrease_available_quantity_1(self):
        """ Decrease the available quantity when no quants are already in a location.
        """
        stock_location = self.env.ref('stock.stock_location_stock')
        product1 = self.env['product.product'].create({
            'name': 'Product A',
            'type': 'product',
        })
        self.env['stock.quant'].decrease_available_quantity(product1, stock_location, 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(product1, stock_location), -1.0)

    def test_decrease_available_quantity_2(self):
        """ Decrease the available quantity when multiple quants are already in a location.
        """
        stock_location = self.env.ref('stock.stock_location_stock')
        product1 = self.env['product.product'].create({
            'name': 'Product A',
            'type': 'product',
        })
        for i in xrange(2):
            self.env['stock.quant'].create({
                'product_id': product1.id,
                'location_id': stock_location.id,
                'quantity': 1.0,
            })
        self.assertEqual(self.env['stock.quant'].get_available_quantity(product1, stock_location), 2.0)
        self.assertEqual(len(self.env['stock.quant']._gather(product1, stock_location)), 2)
        self.env['stock.quant'].decrease_available_quantity(product1, stock_location, 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(product1, stock_location), 1.0)
        self.assertEqual(len(self.env['stock.quant']._gather(product1, stock_location)), 2)

    def test_decrease_available_quantity_3(self):
        """ Decrease the available quantity when a concurrent transaction is already increasing
        the reserved quanntity for the same product.
        """
        stock_location = self.env.ref('stock.stock_location_stock')
        product = self.env.ref('product.product_product_12')
        self.assertEqual(self.env['stock.quant'].get_available_quantity(product, stock_location), 10.0)
        quants = self.env['stock.quant']._gather(product, stock_location)
        self.assertEqual(len(quants), 1)

        # opens a new cursor and SELECT FOR UPDATE the quant, to simulate another concurrent reserved
        # quantity increase
        cr2 = self.registry.cursor()
        cr2.execute("SELECT 1 FROM stock_quant WHERE id = %s FOR UPDATE", quants.ids)
        self.env['stock.quant'].decrease_available_quantity(product, stock_location, 1.0)
        cr2.rollback()
        cr2.close()
        self.assertEqual(self.env['stock.quant'].get_available_quantity(product, stock_location), 9.0)
        self.assertEqual(len(self.env['stock.quant']._gather(product, stock_location)), 2)

    def test_increase_reserved_quantity_1(self):
        """ Increase the reserved quantity of quantity x when there's a single quant in a given
        location which has an available quantity of x.
        """
        stock_location = self.env.ref('stock.stock_location_stock')
        product1 = self.env['product.product'].create({
            'name': 'Product A',
            'type': 'product',
        })
        self.env['stock.quant'].create({
            'product_id': product1.id,
            'location_id': stock_location.id,
            'quantity': 10.0,
        })
        self.assertEqual(self.env['stock.quant'].get_available_quantity(product1, stock_location), 10.0)
        self.assertEqual(len(self.env['stock.quant']._gather(product1, stock_location)), 1)
        self.env['stock.quant'].increase_reserved_quantity(product1, stock_location, 10.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(product1, stock_location), 0.0)
        self.assertEqual(len(self.env['stock.quant']._gather(product1, stock_location)), 1)

    def test_increase_reserved_quantity_2(self):
        """ Increase the reserved quantity of quantity x when there's two quants in a given
        location which have an available quantity of x together.
        """
        stock_location = self.env.ref('stock.stock_location_stock')
        product1 = self.env['product.product'].create({
            'name': 'Product A',
            'type': 'product',
        })
        for i in xrange(2):
            self.env['stock.quant'].create({
                'product_id': product1.id,
                'location_id': stock_location.id,
                'quantity': 5.0,
            })
        self.assertEqual(self.env['stock.quant'].get_available_quantity(product1, stock_location), 10.0)
        self.assertEqual(len(self.env['stock.quant']._gather(product1, stock_location)), 2)
        self.env['stock.quant'].increase_reserved_quantity(product1, stock_location, 10.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(product1, stock_location), 0.0)
        self.assertEqual(len(self.env['stock.quant']._gather(product1, stock_location)), 2)

    def test_increase_reserved_quantity_3(self):
        """ Increase the reserved quantity of quantity x when there's multiple quants in a given
        location which have an available quantity of x together.
        """
        stock_location = self.env.ref('stock.stock_location_stock')
        product1 = self.env['product.product'].create({
            'name': 'Product A',
            'type': 'product',
        })
        self.env['stock.quant'].create({
            'product_id': product1.id,
            'location_id': stock_location.id,
            'quantity': 5.0,
            'reserved_quantity': 2.0,
        })
        self.env['stock.quant'].create({
            'product_id': product1.id,
            'location_id': stock_location.id,
            'quantity': 10.0,
            'reserved_quantity': 12.0,
        })
        self.env['stock.quant'].create({
            'product_id': product1.id,
            'location_id': stock_location.id,
            'quantity': 8.0,
            'reserved_quantity': 3.0,
        })
        self.env['stock.quant'].create({
            'product_id': product1.id,
            'location_id': stock_location.id,
            'quantity': 35.0,
            'reserved_quantity': 12.0,
        })
        # total quantity: 58
        # total reserved quantity: 29
        self.assertEqual(self.env['stock.quant'].get_available_quantity(product1, stock_location), 29.0)
        self.assertEqual(len(self.env['stock.quant']._gather(product1, stock_location)), 4)
        self.env['stock.quant'].increase_reserved_quantity(product1, stock_location, 10.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(product1, stock_location), 19.0)
        self.assertEqual(len(self.env['stock.quant']._gather(product1, stock_location)), 4)

    def test_increase_reserved_quantity_4(self):
        """ Increase the reserved quantity of quantity x when there's a multiple quants in a given
        location which have an available quantity of x together.
        """
        stock_location = self.env.ref('stock.stock_location_stock')
        product1 = self.env['product.product'].create({
            'name': 'Product A',
            'type': 'product',
        })
        self.env['stock.quant'].create({
            'product_id': product1.id,
            'location_id': stock_location.id,
            'quantity': 5.0,
            'reserved_quantity': 7.0,
        })
        self.env['stock.quant'].create({
            'product_id': product1.id,
            'location_id': stock_location.id,
            'quantity': 10.0,
            'reserved_quantity': 10.0,
        })
        self.assertEqual(self.env['stock.quant'].get_available_quantity(product1, stock_location), -2.0)
        self.assertEqual(len(self.env['stock.quant']._gather(product1, stock_location)), 2)
        self.env['stock.quant'].increase_reserved_quantity(product1, stock_location, 10.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(product1, stock_location), -2.0)
        self.assertEqual(len(self.env['stock.quant']._gather(product1, stock_location)), 2)
