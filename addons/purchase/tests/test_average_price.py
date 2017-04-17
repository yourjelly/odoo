# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo.tests.common import TransactionCase
import time
from odoo.modules.module import get_module_resource
from odoo import tools


class TestAveragePrice(TransactionCase):

    def _create_purchase(self, product, uom_id, product_qty=0.0, price_unit=0.0):
        return self.Purchase.create({
             'partner_id': self.partner_id,
             'order_line': [(0, 0, {
                 'name': product.name,
                 'product_id': product.id,
                 'product_qty': product_qty,
                 'product_uom': uom_id,
                 'price_unit': price_unit,
                 'date_planned': time.strftime('%Y-%m-%d'),
                 })]
             })

    def _load(self, module, *args):
        tools.convert_file(self.cr, 'purchase',
                           get_module_resource(module, *args),
                           {}, 'init', False, 'test', self.registry._assertion_report)

    def test_00_average_price(self):
        """ Testing average price computation"""
        self._load('account', 'test', 'account_minimal_test.xml')
        self._load('purchase', 'test', 'stock_valuation_account.xml')
        self.Purchase = self.env['purchase.order']
        self.partner_id = self.ref('base.res_partner_3')
        self.uom_kg_id = self.ref('product.product_uom_kgm')
        self.location_id = self.ref('stock.stock_location_stock')
        self.location_dest_id = self.ref('stock.stock_location_customers')
        # Set a product as using average price.
        self.product_average_icecream = self.env['product.product'].create({
            'default_code': 'AVG',
            'name': 'Average Ice Cream',
            'type': 'product',
            'categ_id': self.ref('product.product_category_1'),
            'uom_id': self.uom_kg_id,
            'uom_po_id': self.uom_kg_id,
            'valuation': 'real_time',
            'cost_method': 'average',
            'property_stock_account_input': self.env['account.account'].search([('code', '=', 'X1114')])[0],
            'property_stock_account_output': self.env['account.account'].search([('code', '=', 'X1016')])[0],
            'supplier_taxes_id': [],
            'description': 'Average Ice Cream can be mass-produced and thus is widely available in developed parts of the world. Ice cream can be purchased in large cartons (vats and squrounds) from supermarkets and grocery stores, in smaller quantities from ice cream shops, convenience stores, and milk bars, and in individual servings from small carts or vans at public events.',
        })
        # I create a draft Purchase Order for first incoming shipment for 10 pieces at 60€
        self.purchase_order_average_1 = self._create_purchase(product=self.product_average_icecream, uom_id=self.uom_kg_id, product_qty=10.0, price_unit=60.0)
        # I confirm the first purchase order
        self.purchase_order_average_1.button_confirm()
        # I check the "Approved" status of purchase order 1
        self.assertEqual(self.purchase_order_average_1.state, 'purchase', "Wrong state of purchase order!")
        # Process the reception of purchase order 1
        self.purchase_order_average_1.picking_ids[0].do_transfer()
        # Check the standard price of the product (average icecream).
        self.assertEqual(self.product_average_icecream.qty_available, 10.0, 'Wrong quantity in stock after first reception')
        self.assertEqual(self.product_average_icecream.standard_price, 60.0, 'Standard price should not have changed!')
        # I create a draft Purchase Order for second incoming shipment for 30 pieces at 80€
        self.purchase_order_average_2 = self._create_purchase(product=self.product_average_icecream, uom_id=self.uom_kg_id, product_qty=30.0, price_unit=80.0)
        # I confirm the second purchase order
        self.purchase_order_average_2.button_confirm()
        # Process the reception of purchase order 2
        self.purchase_order_average_2.picking_ids[0].do_transfer()
        # Check the standard price
        self.assertEqual(self.product_average_icecream.standard_price, 75.0, 'After second reception, we should have an average price of 75.0 on the product')
        # # Create picking to send some goods
        self.outgoing_average_shipment = self.Picking = self.env["stock.picking"].create({
            'picking_type_id': self.ref('stock.picking_type_out'),
            'location_id': self.location_id,
            'location_dest_id': self.location_dest_id})
        # Create move for picking
        self.outgoing_shipment_average_icecream = self.env['stock.move'].create({
            'name': 'outgoing_shipment_avg_move',
            'picking_id': self.outgoing_average_shipment.id,
            'product_id': self.product_average_icecream.id,
            'product_uom': self.uom_kg_id,
            'location_id':  self.location_id,
            'location_dest_id': self.location_dest_id,
            'product_uom_qty': 20.0, })
        # I assign this outgoing shipment and process the delivery
        self.outgoing_average_shipment.action_assign()
        self.outgoing_average_shipment.do_transfer()
        # Check the standard price (60 * 10 + 30 * 80) / 40 = 75.0 did not change
        self.assertEqual(self.product_average_icecream.standard_price, 75.0, 'Standard price should not have changed with outgoing picking!')
        self.assertEqual(self.product_average_icecream.qty_available, 20.0, 'Pieces were not picked correctly as the quantity on hand is wrong')
        # Make a new purchase order with 500 g Average Ice Cream at a price of 0.2€/g
        self.purchase_order_average_3 = self._create_purchase(product=self.product_average_icecream, uom_id=self.ref('product.product_uom_gram'), product_qty=500.0, price_unit=0.2)
        # I confirm the first purchase order
        self.purchase_order_average_3.button_confirm()
        # Process the reception of purchase order 3 in grams
        self.purchase_order_average_3.picking_ids[0].do_transfer()
        # Check price is (75.0*20 + 200*0.5) / 20.5 = 78.04878
        self.assertEqual(self.product_average_icecream.qty_available, 20.5, 'Reception of purchase order in grams leads to wrong quantity in stock')
        self.assertEqual(round(self.product_average_icecream.standard_price, 2), 78.05, 'Standard price as average price of third reception with other UoM incorrect! Got %s instead of 78.05' % (round(self.product_average_icecream.standard_price, 2)))
