# -*- coding: utf-8 -*-

from odoo.addons.stock_dropshipping.tests.common import TestStockDropshippingCommon


class TestDropship(TestStockDropshippingCommon):

    def test_00_dropship(self):
        """Check for dropshipping Flow"""

        self.route_drop_shipping = self.ref('stock_dropshipping.route_drop_shipping')
        self.supplier_dropship = self.Partner.create({'name': 'Vendor of Dropshipping test'})

        # Creating Product
        self.product = self.Product.create({
            'name': "PCE",
            'list_price': 100.0,
            'standard_price': 70.0,
            'type': "product",
            'categ_id': self.category_all.id,
            'seller_ids': [(0, 0, {'delay': 1, 'name': self.supplier_dropship.id, 'min_qty': 2.0})]})

        # Creating Sale Order
        self.sale_order_drp_shpng = self._create_sale_order(
                                        partner_id=self.partner.id,
                                        product_id=self.product.id,
                                        product_qty=200,
                                        uom_id=self.uom_unit.id)
        # Set route on sale order line
        self.sale_order_drp_shpng.order_line.route_id = self.route_drop_shipping
        # Confirm sale order
        self.sale_order_drp_shpng.action_confirm()

        # Check the sales order created a procurement group which has a procurement of 200 pieces
        procurement_order = self.ProcurementOrder.search([('group_id.name', '=', self.sale_order_drp_shpng.name)], limit=1)
        self.assertEquals(procurement_order.product_qty, 200.0, 'procurement group should have 200 pieces.')

        # Check a quotation was created to a certain vendor and confirm so it becomes a confirmed purchase order
        purchase = self.PurchaseOrder.search([('partner_id', '=', self.supplier_dropship.id)])
        self.assertEquals(len(purchase), 1, 'There should be one purchase order.')
        # Confirm Purchase order
        purchase.button_confirm()
        self.assertEquals(purchase.state, 'purchase', 'Purchase order should be in the approved state')

        # Use 'Receive Products' button to immediately view this picking, it should have created a picking with 200 pieces
        # Send the 200 pieces.
        pickings = purchase[0].picking_ids
        pickings.do_transfer()

        # Check one quant was created in Customers location with 200 pieces and one move in the history_ids
        quants = self.env['stock.quant'].search([('location_id', '=', self.customer_location_id), ('product_id', '=', self.product.id)])
        self.assertTrue(quants, 'No quant found!')
        self.assertEquals(len(quants.ids), 1, 'There should be exactly one quant')
        self.assertEquals(len(quants[0].history_ids), 1, 'The quant should have exactly 1 move in its history')
