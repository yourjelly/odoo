# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import time

from odoo.tests import common
from odoo.modules.module import get_resource_path
from odoo import tools


class TestFifoPrice(common.TransactionCase):

    def _load(self, module, *args):
        tools.convert_file(self.cr, 'purchase',
                           get_resource_path(module, *args),
                           {},'init',False,'test',self.registry._assertion_report)

    def setUp(self):
        super(TestFifoPrice, self).setUp()

        # Usefull models
        self.ResCompany = self.env['res.company']
        self.Product = self.env['product.product']
        self.PurchaseOrder = self.env['purchase.order']
        self.StockPicking = self.env['stock.picking']
        self.ResCurrency = self.env['res.currency']
        self.Move = self.env['stock.move']

        # #UseFull Reference
        self.company = self.env.ref('base.main_company')
        self.uom_kgm_id = self.ref('product.product_uom_kgm')
        self.uom_gram_id = self.ref('product.product_uom_gram')
        self.partner_id = self.ref('base.res_partner_3')
        self.categ_id = self.ref('product.product_category_1')
        self.stock_picking_type_out_id = self.ref('stock.picking_type_out')
        self.location_stock_id = self.ref('stock.stock_location_stock')
        self.location_stock_cust_id = self.ref('stock.stock_location_customers')

    def test_00_test_fifo(self):
        """ Test product cost price with fifo removal strategy."""

        #  ------------------------------------------------------------------
        #   Create product icecream with standard price 70 EUR
        #   Create a draft purchase Order
        #       First purchase order = 10 kg with price 50 EUR
        #       Second purchase order = 30 kg with price 80 EUR
        #   Confirm & receive goods for first and second purchase order.
        #   Check the status of purchase order ( will be 'purchase')
        #   Check the standard price of the product ( will be 70 EUR ).
        #   Deliver some goods to customer ( 20 kg ).
        #   Check standard price of product after delivered goods ( will be 65 EUR ).
        #   Deliver some goods to customer ( 500 Gram ).
        #   Check standard price of product after delivered goods ( will be 80 EUR ).

        #  -------------------------------------------------------------------


        self._load('account', 'test', 'account_minimal_test.xml')
        self._load('stock_account', 'test', 'stock_valuation_account.xml')
        self.company.currency_id = self.env.ref('base.EUR')
        self.product_fifo_icecream = self.Product.create({
                'default_code': 'FIFO',
                'name': 'FIFO Ice Cream',
                'type': 'product',
                'categ_id': self.categ_id,
                'list_price': 100.0,
                'standard_price': 70.0,
                'uom_id': self.uom_kgm_id,
                'uom_po_id': self.uom_gram_id,
                'cost_method': 'real',
                'valuation': 'real_time',
                'property_stock_account_input': self.ref('purchase.o_expense'),
                'property_stock_account_output': self.ref('purchase.o_income'),
                'supplier_taxes_id': '[]',
                'description': 'FIFO Ice Cream can be mass-produced and thus is widely available in developed parts of the world. Ice cream can be purchased in large cartons (vats and squrounds) from supermarkets and grocery stores, in smaller quantities from ice cream shops, convenience stores, and milk bars, and in individual servings from small carts or vans at public events.',
                })

        # I create draft Purchase Order for first in move for 10 kg at 50 euro
        self.purchase_order_fifo1 = self.PurchaseOrder.create({
                'partner_id': self.partner_id,
                'order_line': [(0, 0, {'product_id': self.product_fifo_icecream.id, 'product_qty': 10.0, 'product_uom': self.uom_kgm_id, 'price_unit': 50.0 , 'name': 'FIFO Ice Cream', 'date_planned': time.strftime('%Y-%m-%d')})], 
            })

        # I confirm the first purchase order
        self.purchase_order_fifo1.button_confirm()

        # I check the "Purchase" status of purchase order 1
        self.assertEquals(self.purchase_order_fifo1.state, 'purchase', 'True')

        # Process the reception of purchase order 1 and set date
        picking = self.purchase_order_fifo1.picking_ids[0]
        picking.do_transfer()

        # Check the standard price of the product (fifo icecream)
        self.assertEquals(self.product_fifo_icecream.standard_price ,70.0 , 'Standard price should not have changed!')

        # I create draft Purchase Order second shipment for 30 kg at 80 euro
        self.purchase_order_fifo2 = self.PurchaseOrder.create({
                'partner_id': self.partner_id,
                'order_line': [(0, 0, {'product_id': self.product_fifo_icecream.id, 'product_qty': 30.0, 'product_uom': self.uom_kgm_id, 'price_unit': 80.0 , 'name' : 'FIFO Ice Cream', 'date_planned': time.strftime('%Y-%m-%d')})], 
            })
        # I confirm the second purchase order
        self.purchase_order_fifo2.button_confirm()
        self.assertEquals(self.purchase_order_fifo2.state, 'purchase', 'True')
        # Process the reception of purchase order 2
        picking = self.purchase_order_fifo2.picking_ids[0]
        picking.do_transfer()
        # Check the standard price of the product
        self.assertEquals(self.product_fifo_icecream.standard_price, 70.0 , 'Standard price should not have changed!')
        # Let us send some goods
        self.outgoing_fifo_shipment = self.StockPicking.create({
                'picking_type_id': self.stock_picking_type_out_id,
                'location_id': self.location_stock_id,
                'location_dest_id': self.location_stock_cust_id})
        # Picking needs movement from stock.
        self.outgoing_shipment_fifo_icecream = self.Move.create({
            'name': 'a move',
            'picking_id': self.outgoing_fifo_shipment.id,
            'product_id': self.product_fifo_icecream.id,
            'product_uom': self.uom_kgm_id,
            'location_id':  self.location_stock_id,
            'location_dest_id': self.location_stock_cust_id,
            'product_uom_qty': 20.0,
            'picking_type_id': self.stock_picking_type_out_id})
        # I assign this outgoing shipment.
        self.outgoing_fifo_shipment.action_assign()
        # Process the delivery of the outgoing shipment.
        # 10 kg* 50 , 10 kg* 80 = 1300 /20 =65
        # 20 * 80 = 1600
        self.outgoing_fifo_shipment.do_transfer()
        # Check standard price became 65.0 euro.
        self.assertEqual(self.product_fifo_icecream.standard_price, 65.0, 'Standard price should not have changed!')
        # Do a delivery of an extra 500 g (delivery order)
        self.outgoing_fifo_shipment_uom = self.StockPicking.create({
                'picking_type_id': self.stock_picking_type_out_id,
                'location_id': self.location_stock_id,
                'location_dest_id': self.location_stock_cust_id
                })
        # Picking needs movement from stock
        self.outgoing_shipment_fifo_icecream_gram = self.Move.create({
            'name': 'a move',
            'picking_id': self.outgoing_fifo_shipment_uom.id,
            'product_id': self.product_fifo_icecream.id,
            'product_uom': self.uom_gram_id,
            'location_id':  self.location_stock_id,
            'location_dest_id': self.location_stock_cust_id,
            'product_uom_qty': 500.0,
            'picking_type_id': self.stock_picking_type_out_id})
        self.outgoing_fifo_shipment_uom.action_assign()
        self.outgoing_fifo_shipment_uom.do_transfer()
        # 19.5  * 80
        self.assertEqual(self.product_fifo_icecream.standard_price, 80.0, 'Standard price should not have changed!')
        # Purchase order in USD
        # 19.5 * 80 = 1600
        # 40 * 150 = 6000
        # -------------------------------------------------------------------------------------------------------------------
        #   Purchase order in USD
        #   Create PO for 30000 g at 0.150 USD/g and 10 kg at 150 USD/kg
        #   Confirm & receive the purchase order in USD
        #   We create delivery order of ( 49.5 kg )
        #   Assign and Process the delivery of the outgoing shipment
        #   Check rounded price is 102 euro (because last outgoing shipment was made of 19.5kg at 80€ and 30kg at $150 (rate=1.2834)
        #   Do a delivery of an extra ( 10 kg )
        #   Assign and Process the delivery of the outgoing shipment
        #   Check rounded price is 150.0 / 1.2834
        # ---------------------------------------------------------------------------------------------------------------------
        self.NewUSD = self.ResCurrency.create({
            'name': 'new_usd',
            'symbol': '$²',
            'rate_ids': [(0, 0, { 'rate': 1.2834, 'name': time.strftime('%Y-%m-%d')})],
        })
        # create PO for 30000 g at 0.150 USD/g and 10 kg at 150 USD/kg
        self.purchase_order_fifo_usd = self.PurchaseOrder.create({
            'partner_id': self.partner_id,
            'currency_id': self.NewUSD.id,
            'order_line': [
                (0, 0, {'product_id': self.product_fifo_icecream.id, 'product_qty':30000 ,'product_uom': self.uom_gram_id , 'price_unit' : 0.150, 'name' : 'FIFO Ice Cream',  'date_planned': time.strftime('%Y-%m-%d')}),
                (0, 0, {'product_id': self.product_fifo_icecream.id, 'product_qty':10.0 ,'product_uom': self.uom_kgm_id , 'price_unit' : 150.0, 'name' : 'FIFO Ice Cream',  'date_planned': time.strftime('%Y-%m-%d')})]})
        # I confirm the purchase order in USD
        self.purchase_order_fifo_usd.button_confirm()
        # Process the reception of purchase order with usd
        picking = self.purchase_order_fifo_usd.picking_ids[0]
        picking.do_transfer()
        # We create delivery order of 49.5 kg
        self.outgoing_fifo_shipment_cur = self.StockPicking.create({
            'picking_type_id': self.stock_picking_type_out_id,
            'location_id': self.location_stock_id,
            'location_dest_id': self.location_stock_cust_id,
            })
        # Picking needs movement from stock
        self.outgoing_shipment_fifo_icecream_cur = self.Move.create({
            'name': 'a move',
            'picking_id': self.outgoing_fifo_shipment_cur.id,
            'product_id': self.product_fifo_icecream.id,
            'product_uom': self.uom_kgm_id,
            'product_uom_qty': 49.5,
            'location_id': self.location_stock_id,
            'location_dest_id': self.location_stock_cust_id,
            'picking_type_id': self.stock_picking_type_out_id
            })
        # I assign this outgoing shipment
        self.outgoing_fifo_shipment_cur.action_assign()
        self.outgoing_fifo_shipment_cur.do_transfer()
        self.assertEqual(round(self.product_fifo_icecream.standard_price),102 ,'Product price not updated accordingly.')
        # Do a delivery of an extra 10 kg
        self.outgoing_fifo_shipment_ret = self.StockPicking.create({
            'picking_type_id': self.stock_picking_type_out_id,
            'location_id': self.location_stock_id,
            'location_dest_id': self.location_stock_cust_id,
            })
        # Picking needs movement from stock
        self.outgoing_shipment_fifo_icecream_ret = self.Move.create({
            'name': 'a move',
            'picking_id': self.outgoing_fifo_shipment_ret.id,
            'product_id': self.product_fifo_icecream.id,
            'product_uom': self.uom_kgm_id,
            'product_uom_qty': 10.0,
            'location_id': self.location_stock_id,
            'location_dest_id': self.location_stock_cust_id,
            'picking_type_id': self.stock_picking_type_out_id
            })
        # I assign this outgoing shipment
        self.outgoing_fifo_shipment_ret.action_assign()
        self.outgoing_fifo_shipment_ret.do_transfer()
        # Check rounded price is 150.0 / 1.2834
        # 116.87
        self.assertEqual(round(self.product_fifo_icecream.standard_price),round(150.0/1.2834),'Standard price should not have changed!')
        self.assertEqual(round(self.product_fifo_icecream.qty_available), 0.0, 'Wrong quantity in stock after first reception.')

        # -------------------------------------------------------------------------------
        # Create product FIFO Negative with standard price 70 EUR stock for a new product
        #       First delivery order of ( 100 kg )
        #       Second delivery order of ( 400 kg )
        # Process the delivery of the first outgoing shipment
        # Receive purchase order with 50 kg FIFO Ice Cream at 50 euro/kg
        # Receive purchase order with 60 kg FIFO Ice Cream at 80 euro/kg
        # -------------------------------------------------------------------------------
        # Let us create some outs to get negative stock for a new product using the same config
        self.product_fifo_negative = self.Product.create({
            'default_code': 'NEG',
            'name': 'FIFO Negative',
            'type': 'product',
            'categ_id': self.categ_id,
            'list_price': 100.0,
            'standard_price': 70.0,
            'uom_id': self.uom_kgm_id,
            'uom_po_id': self.uom_kgm_id,
            'cost_method': 'real',
            'valuation': 'real_time',
            'property_stock_account_input': self.ref('purchase.o_expense'),
            'property_stock_account_output': self.ref('purchase.o_income'),
            })
        # Create outpicking.  We create delivery order of 100 kg.
        self.outgoing_fifo_shipment_neg = self.StockPicking.create({
            'picking_type_id': self.stock_picking_type_out_id,
            'location_id': self.location_stock_id,
            'location_dest_id': self.location_stock_cust_id,
            })
        # Picking needs movement from stock
        self.outgoing_shipment_fifo_icecream_neg = self.Move.create({
            'name': 'a move',
            'picking_id': self.outgoing_fifo_shipment_neg.id,
            'product_id': self.product_fifo_negative.id,
            'product_uom': self.uom_kgm_id,
            'product_uom_qty': 100.0,
            'location_id': self.location_stock_id,
            'location_dest_id': self.location_stock_cust_id,
            'picking_type_id': self.stock_picking_type_out_id
            })
        # Process the delivery of the first outgoing shipment
        self.outgoing_fifo_shipment_neg.do_transfer()
        # The behavior of fifo/lifo is not garantee if the quants are created at the same second, so i just wait one second
        time.sleep(1)
        # Let us create another out of 400 kg
        self.outgoing_fifo_shipment_neg2 = self.StockPicking.create({
            'picking_type_id': self.stock_picking_type_out_id,
            'location_id': self.location_stock_id,
            'location_dest_id': self.location_stock_cust_id,
            })
        # Picking needs movement from stock
        self.outgoing_shipment_fifo_icecream_neg2 = self.Move.create({
            'name': 'a move',
            'picking_id': self.outgoing_fifo_shipment_neg2.id,
            'product_id': self.product_fifo_negative.id,
            'product_uom': self.uom_kgm_id,
            'product_uom_qty': 400.0,
            'location_id': self.location_stock_id,
            'location_dest_id': self.location_stock_cust_id,
            'picking_type_id': self.stock_picking_type_out_id
            })
        # Process the delivery of the outgoing shipments
        self.outgoing_fifo_shipment_neg2.do_transfer()
        # Receive purchase order with 50 kg FIFO Ice Cream at 50 euro/kg
        self.purchase_order_fifo_neg = self.PurchaseOrder.create({
            'partner_id': self.partner_id,
            'order_line':[(0, 0, {'product_id': self.product_fifo_negative.id, 'product_qty': 50.0, 'product_uom': self.uom_kgm_id, 'price_unit': 50.0 , 'name' : 'FIFO Ice Cream', 'date_planned': time.strftime('%Y-%m-%d')})], 
            })
        self.purchase_order_fifo_neg.button_confirm()
        picking = self.purchase_order_fifo_neg.picking_ids[0]
        picking.do_transfer()
        self.assertEquals(self.product_fifo_negative.standard_price, 70.0 , 'Standard price should not have changed!')
        # Receive purchase order with 60 kg FIFO Ice Cream at 80 euro/kg
        self.purchase_order_fifo_neg2 = self.PurchaseOrder.create({
            'partner_id':self.partner_id,
            'order_line':[(0, 0, {'product_id': self.product_fifo_negative.id, 'product_qty': 60.0, 'product_uom': self.uom_kgm_id, 'price_unit': 80.0 , 'name' : 'FIFO Ice Cream', 'date_planned': time.strftime('%Y-%m-%d')})],
            })
        self.purchase_order_fifo_neg2.button_confirm()
        picking = self.purchase_order_fifo_neg2.picking_ids[0]
        picking.do_transfer()
        self.assertEquals(self.product_fifo_negative.standard_price, 65.0 , 'Standard price should not have changed!')
