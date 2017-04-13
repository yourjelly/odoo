# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo.tests import common
from odoo.tools import config
from odoo import netsvc


class TestDropship(common.TransactionCase):

    def setUp(self):
        super(TestDropship, self).setUp()
        # Usefull models
        self.ResPartner = self.env['res.partner']
        self.Product = self.env['product.product']
        self.SaleOrder = self.env['sale.order']
        self.ProcurementGroup = self.env['procurement.group']
        self.PurchaseOrder = self.env['purchase.order']
        self.StockPicking = self.env['stock.picking']
        self.StockQuant = self.env['stock.quant']

        self.category_1_id = self.ref('product.product_category_1')
        self.uom_unit_id = self.ref('product.product_uom_unit')
        self.partner_id = self.ref('base.res_partner_2')
        self.payment_term_id = self.ref('account.account_payment_term')
        self.route_drop_shipping = self.ref('stock_dropshipping.route_drop_shipping')
        self.location_id = self.ref('stock.stock_location_customers')
        self.supplier_dropship = self.ResPartner.create({'name': 'Vendor of Dropshipping test'})
        print ">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>Vendor Created", self.supplier_dropship

        self.drop_shop_product = self.Product.create({
                'name': 'Pen drive',
                'type': 'product',
                'categ_id': self.category_1_id,
                'list_price': 100.0,
                'standard_price': 0.0,
                'seller_ids': [
                    (0, 0, 
                        {
                            'delay': 1,
                            'name': self.supplier_dropship.id,
                            'min_qty': 2.0,
                        }
                    )
                    ],
                'uom_id': self.uom_unit_id,
                'uom_po_id': self.uom_unit_id,

            })
        print ">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>Product Created", self.drop_shop_product.name
             
        self.sale_order_drp_shpng = self.SaleOrder.create({
                'partner_id': self.partner_id,
                'note': 'Create sale order for drop shipping',
                'payment_term_id': self.payment_term_id,
                'list_price': 100.0,
                'standard_price': 0.0,
                'order_line':[
                    (0, 0, 
                        {
                            'product_id': self.drop_shop_product.id,
                            'product_uom_qty': 200,
                            'price_unit': 1.00,
                            'route_id': self.route_drop_shipping,
                        }
                    )
                    ],

            })
        print ">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>SO Created"
    
    def test_00_dropship(self):
        """Check for Confirm sales order"""
        self.sale_order_drp_shpng.action_confirm()
        print "SO confirmed"

    # def test_01_dropship(self):
        """Check the sales order created a procurement group which has a procurement of 200 pieces"""
        sale_record = self.SaleOrder.search([('id', '=', self.sale_order_drp_shpng.id)])
        self.assertTrue(sale_record.procurement_group_id.procurement_ids[0].product_qty == 200.0, 'procurement group  should have 200 pieces.')

    # def test_02_dropship(self):
        """Check a quotation was created to a certain vendor and confirm so it becomes a confirmed purchase order"""
        sale_record = self.SaleOrder.search([('id', '=', self.sale_order_drp_shpng.id)])
        procurement_order = sale_record.procurement_group_id.procurement_ids[0]
        purchase = procurement_order.purchase_line_id.order_id
        
        purchase.button_confirm()
        po_id = self.PurchaseOrder.search([('partner_id', '=', self.supplier_dropship.id)])
        self.assertTrue(purchase.state == 'purchase', 'Purchase order should be in the approved state')

        """Use 'Receive Products' button to immediately view this picking, it should have created a picking with 200 pieces"""
        po_id = self.PurchaseOrder.search([('partner_id', '=', self.supplier_dropship.id)])
        self.assertTrue(len(po_id) == 1, 'There should be one picking')

        """Send the 200 pieces."""
        po = self.PurchaseOrder.search([('partner_id', '=', self.supplier_dropship.id)])
        self.assertTrue(po.ids and len(po.ids) == 1, 'Problem with the Purchase Order detected')
        pickings = po[0].picking_ids
        pickings.do_transfer()

        """Check one quant was created in Customers location with 200 pieces and one move in the history_ids"""
        quants = self.StockQuant.search([('location_id', '=', self.location_id), ('product_id', '=', self.drop_shop_product.id)])
        self.assertTrue(quants, 'No Quant found')
        self.assertTrue(len(quants.ids) == 1, 'There should be exactly one quant')
        self.assertTrue(len(quants[0].history_ids) == 1, 'The quant should have exactly 1 move in its history')
