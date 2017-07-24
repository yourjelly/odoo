# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.stock_dropshipping.tests.common import TestStockDropshippingCommon


class TestCancellationPropagated(TestStockDropshippingCommon):

    def test_cancelation_propogation(self):
        """ Test cancellation propagation """

        # Supplier
        self.partner2_id = self.ref('base.res_partner_2')

        # Useful Reference
        self.uom_dozen_id = self.ref('product.product_uom_dozen')
        self.main_warehouse = self.env.ref('stock.warehouse0')
        self.price_list_id = self.ref('product.list0')

        # Create a new product
        self.product_mto = self.Product.create({
            'name': 'My Product',
            'type': 'product',
            'seller_ids': [(0, 0, {
                'delay': 1,
                'name': self.partner2_id,
                'min_qty': 2.0,
                 })]
            })

        # Create a sales order of 5 Units "My Product"
        self.so_product_mto = self._create_sale_order(
                                        partner_id=self.ref('base.res_partner_3'),
                                        product=self.product_mto,
                                        product_qty=5.00,
                                        uom_id=self.uom_unit.id)

        # Create another sales order with 2 Dozen of "My Product"
        self.so_product_mto2 = self._create_sale_order(
                                        partner_id=self.ref('base.res_partner_4'),
                                        product=self.product_mto,
                                        product_qty=2.00,
                                        uom_id=self.uom_dozen_id)

        # Set routes on product to be MTO and Buy
        route_buy_id = self.main_warehouse.buy_pull_id.route_id.id
        route_mto_id = self.main_warehouse.mto_pull_id.route_id.id
        self.product_mto.write({'route_ids': [(6, 0, [route_mto_id, route_buy_id])]})

        # Confirm sales orders
        self.so_product_mto.action_confirm()
        self.so_product_mto2.action_confirm()

        """ Check the propagation when we cancel the main procurement
            * Retrieve related procurements and check that there are all running
            * Check that a purchase order is well created
            * Cancel the main procurement
            * Check that all procurements related and the purchase order are well canceled
        """

        # Run The Scheduler
        self.ProcurementOrder.run_scheduler()

        # Check procurement created or not.
        procus = self.ProcurementOrder.search([('group_id.name', 'in', [self.so_product_mto.name, self.so_product_mto2.name])])
        self.assertGreater(len(procus), 0, 'No procurement found!')

        # Check procurement all procurement status 'running'
        for procu in procus:
            self.assertEquals(procu.state, 'running', "Procurement should be with running state but state is : %s!'" % (procu.state))

        # Check single purchase order created or not.
        purchases = procus.mapped('purchase_line_id').mapped('order_id')
        # Check that one purchase order has been created
        self.assertEquals(len(purchases.ids), 1, 'No purchase order found !')
        # Check the two purchase order lines
        self.assertEquals(len(purchases.order_line), 1, 'No purchase order found !')
        self.assertEquals(len(purchases.order_line.procurement_ids), 2, 'Wrong procurement on order line !')
        purchase_line = purchases.order_line
        self.assertEquals(purchase_line.product_qty, 29.0, "The product quantity of the order line should be 29 and not %s" % (purchase_line.product_qty,))
        self.assertEquals(purchase_line.product_uom.id, self.uom_unit.id, "'The product uom of the order line should be %s and not %s'" % (self.uom_unit.name, purchase_line.product_uom.name,))

        # Cancel the sales order of 2 dozen.
        self.so_product_mto2.action_cancel()
        procurements2 = self.ProcurementOrder.search([('group_id', '=', self.so_product_mto2.procurement_group_id.id), ('purchase_line_id', '!=', False)])
        self.assertEquals(self.so_product_mto2.state, 'cancel', "Sale order should be cancelled !")
        self.assertEquals(procurements2.mapped('state'), ['cancel'], "Procurement related sale order should be cancelled !")
        self.assertEquals(purchase_line.product_qty, 5.0, "'The product quantity of the order line should be 5 and not %s'" % (purchase_line.product_qty,))

        # Cancel procurement first sales order.
        self.so_product_mto.action_cancel()
        procurements = self.so_product_mto.order_line.procurement_ids
        self.assertEquals(self.so_product_mto.state, 'cancel', "Sale order should be cancelled !")
        self.assertEquals(procurements.mapped('state'), ['cancel'], "Procurement related sale order should be cancelled !")
        self.assertEquals(len(purchases.order_line), 0, "The PO line should have been unlinked!")

        # Check that all procurements related are cancelled or not.
        for procu in procus:
            self.assertEquals(procu.state, 'cancel', "'Procurement should be cancelled but is with a state : %s!'" % (procu.state))
