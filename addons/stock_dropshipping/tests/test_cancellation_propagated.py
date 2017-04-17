# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests import common


class TestCancellationPropagated(common.TransactionCase):

    def _create_sale_order(self, partner_id, product_qty, uom_id):
        so_values = {
            'partner_id': partner_id,
            'note': 'Create sale order for product iPad Retina Display',
            'warehouse_id': self.wh_pps.id,
            'pricelist_id': self.price_list_id,
            'order_line': [(0, 0, {
                'product_id': self.product_mto.id,
                'name': "product_mto",
                'product_uom_qty': product_qty,
                'product_uom': uom_id
             })]
        }
        return self.SaleOrder.create(so_values)

    def setUp(self):
        super(TestCancellationPropagated, self).setUp()

        """  Models """
        self.SaleOrder = self.env['sale.order']
        self.Procurement = self.env['procurement.order']
        self.partner2_id = self.ref('base.res_partner_2')
        self.partner3_id = self.ref('base.res_partner_3')
        self.partner4_id = self.ref('base.res_partner_4')

        # Use full reference.
        self.uom_unit_id = self.ref('product.product_uom_unit')
        self.uom_dozen_id = self.ref('product.product_uom_dozen')
        self.warehouse = self.env.ref('stock.warehouse0')
        self.price_list_id = self.ref('product.list0')

        # warehouse with pick-pack-ship.

        self.wh_pps = self.env['stock.warehouse'].create({
                'name': 'WareHouse PickPackShip ',
                'code': 'whpps',
                'reception_steps': 'two_steps',
                'delivery_steps': 'pick_pack_ship'
            })

        # create a new product in this warehouse
        self.product_mto = self.env['product.product'].create({
            'name': 'iPad Retina Display ',
            'type': 'product',
            'uom_id': self.uom_unit_id,
            'uom_po_id': self.uom_unit_id,
            'seller_ids': [(0, 0, {
                'delay': 1,
                'name': self.partner2_id,
                'min_qty': 2.0,
                 })]
            })

        # Create a sales order with a line of 5 Units "My Product"
        self.so_product_mto = self._create_sale_order(
                                        partner_id=self.partner3_id,
                                        product_qty=5.00,
                                        uom_id=self.uom_unit_id)

        # Create another sales order with 2 Dozen of the same product
        self.so_product_mto2 = self._create_sale_order(
                                        partner_id=self.partner4_id,
                                        product_qty=2.00,
                                        uom_id=self.uom_dozen_id)

    def test_cancelation_propogation(self):
        """ Test cancelation propogation """

        # Set routes on product to be MTO and Buy
        route_buy_id = self.warehouse.buy_pull_id.route_id.id
        route_mto_id = self.warehouse.mto_pull_id.route_id.id
        self.product_mto.write({
                    'route_ids': [(6, 0, [route_mto_id, route_buy_id])]
                    })

        # Confirm Sales orders
        self.so_product_mto.action_confirm()
        self.so_product_mto2.action_confirm()

        """ Check the propagation when we cancel the main procurement
            * Retrieve related procurements and check that there are all running
            * Check that a purchase order is well created
            * Cancel the main procurement
            * Check that all procurements related and the purchase order are well cancelled """

        # Run The Scheduler
        self.Procurement.run_scheduler()
        procus = self.Procurement.search([('group_id.name', 'in', [self.so_product_mto.name, self.so_product_mto2.name])])
        self.assertGreater(len(procus), 0, 'No procurement found!')

        # Check procurement status
        for procu in procus:
            self.assertEquals(procu.state, 'running', "Procurement with id: %d should be running but is with state : %s!' %(procu.id, procu.state)")
        purchases = procus.mapped('purchase_line_id').mapped('order_id')

        # Check that one purchase order has been created
        self.assertEquals(len(purchases.ids), 1, 'No purchase order found !')

        # Check the two purchase order lines
        purchase_line = purchases.order_line
        uom_id = purchase_line.product_uom.id
        self.assertEquals(purchase_line.product_qty, 29.0, "The product quantity of the first order line should be 5 and not %s % (purchase_line.product_qty,)")
        self.assertEquals(uom_id, self.uom_unit_id, "'The product UoM ID of the first order line should be %s and not %s' % (self.uom_unit_id, uom_id,)")

        # Cancel the Sales Order 2
        procurement2 = self.so_product_mto2.order_line.procurement_ids
        procurement = self.so_product_mto.order_line.procurement_ids
        procurement2.cancel()
        self.assertEquals(procurement2.state ,'cancel', "Procurement 2 should be cancelled !")
        self.assertEquals(purchase_line.product_qty, 5.0, "'The product quantity of the first order line should be 5 and not %s' % (purchase_line.product_qty,)")

        # Cancel the Sales Order 1
        procurement.cancel()
        self.assertEquals(procurement.state ,'cancel', "Procurement 1 should be cancelled !")
        self.assertEquals(len(purchases.order_line), 0, "The PO line should have been unlinked!")

        # Check that all procurements related are cancelled
        for procu in procus:
            self.assertEquals(procu.state ,'cancel', "'Procurement %d should be cancelled but is with a state : %s!' %(procu.id, procu.state)")
