# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.stock_dropshipping.tests.common import TestStockDropshippingCommon
from odoo.modules.module import get_module_resource
from odoo import tools

class TestLifoPriceTest(TestStockDropshippingCommon):
    def setUp(self):
        super(TestLifoPriceTest, self).setUp()
        self.stock_location = self.env.ref('stock.stock_location_stock')
        self.customer_location = self.env.ref('stock.stock_location_customers')
        self.supplier_location = self.env.ref('stock.stock_location_suppliers')
        self.uom_unit = self.env.ref('product.product_uom_unit')

    def _load(self, module, *args):
        tools.convert_file(
            self.cr, 'stock_dropshipping', get_module_resource(module, *args), {}, 'init', False, 'test', self.registry._assertion_report)

    def test_lifoprice(self):
        """ Test that create Product and Purchase order to test LIFO category of Product."""

        self._load('account', 'test', 'account_minimal_test.xml')
        self._load('stock_account', 'test', 'stock_valuation_account.xml')
        # Set the company currency as EURO (€) for the sake of repeatability
        self.env.ref('base.main_company').write({'currency_id': self.ref('base.EUR')})
        # Set product category removal strategy as LIFO.
        self.product_category = self.env['product.category'].create({
            'name': 'Lifo Category',
            'removal_strategy_id': self.ref('stock.removal_lifo')})

        # Set a product as using lifo price.
        self.product1 = self.Product.create({
                'default_code': 'LIFO',
                'name': 'Product A',
                'type': 'product',
                'categ_id': self.product_category.id,
                'valuation': 'real_time',
                'cost_method': 'lifo',
                'property_stock_account_input': self.ref('stock_dropshipping.o_expense'),
                'property_stock_account_output': self.ref('stock_dropshipping.o_income'),
            })

    def test_lifo_perpetual_1(self):

        # Beginning Inventory: 10 units @ 100.00 per unit
        move1 = self.env['stock.move'].create({
            'name': '10 units @ 100.00 per unit',
            'location_id': self.supplier_location.id,
            'location_dest_id': self.stock_location.id,
            'product_id': self.product1.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': 10.0,
            'price_unit': 100,
        })
        move1.action_confirm()
        move1.action_assign()
        move1.move_line_ids.qty_done = 10.0
        move1.action_done()

        self.assertEqual(move1.value, 1000.0)
        self.assertEqual(move1.cumulated_value, 1000.0)

        self.assertEqual(move1.remaining_qty, 10.0)

        # Purchase 30 units @ 80.00 per unit
        move2 = self.env['stock.move'].create({
            'name': '30 units @ 80.00 per unit',
            'location_id': self.supplier_location.id,
            'location_dest_id': self.stock_location.id,
            'product_id': self.product1.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': 30.0,
            'price_unit': 80.00,
        })
        move2.action_confirm()
        move2.action_assign()
        move2.move_line_ids.qty_done = 30
        move2.action_done()

        self.assertEqual(move2.value, 2400)
        self.assertEqual(move1.cumulated_value, 3400.0)

        self.assertEqual(move1.remaining_qty, 10.0)
        self.assertEqual(move2.remaining_qty, 30.0)

        # Sale 20 units
        move3 = self.env['stock.move'].create({
            'name': 'Sale 20 units',
            'location_id': self.stock_location.id,
            'location_dest_id': self.customer_location.id,
            'product_id': self.product1.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': 20.0,
        })

        move3.action_confirm()
        move3.action_assign()
        move3.move_line_ids.qty_done = 20.0
        move3.action_done()

        # so its value should be -(20*80) = -1600
        self.assertEqual(move3.value, -1600.0)
        self.assertEqual(move3.cumulated_value, 1800.0)

        self.assertEqual(move1.remaining_qty, 10)
        self.assertEqual(move2.remaining_qty, 10)
