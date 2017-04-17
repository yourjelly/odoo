from odoo.tests.common import TransactionCase


class TestPurchaseOrderProcess(TransactionCase):
    def setUp(self):
        super(TestPurchaseOrderProcess, self).setUp()
        self.po = self.env.ref('purchase.purchase_order_5')
        self.Product = self.env['product.product']
        self.Procurement = self.env['procurement.order']
        self.scheduler_product = self.Product.create({
            'name': "Scheduler Product",
            'seller_ids': [(0, 0, {
                    'delay': 1,
                    'name': self.ref('base.res_partner_2'),
                    'min_qty': 5.0
                })]
        })
        # Purchase user can also cancel order therfore test with that user which have Purchase user rights.
        self.User = self.env['res.users']
        self.res_users_purchase_user = self.User.create({
            'company_id': self.ref('base.main_company'),
            'name': "Purchase User",
            'login': "pu",
            'email': "purchaseuser@yourcompany.com",
            'groups_id': [(6, 0, [self.ref('purchase.group_purchase_user')])],
            })

    def test_00_cancel_purchase_order_flow(self):
        """ Test Cancel purchase order."""
        # In order to test the cancel flow, I start it from canceling confirmed purchase order.
        po_edit_with_user = self.po.sudo(self.res_users_purchase_user.id)
        # I confirm the purchase order.
        po_edit_with_user.button_confirm()
        # I check the "Approved" status  after confirmed RFQ.
        self.assertEqual(po_edit_with_user.state, 'purchase', 'Purchase: PO state should be "Purchase')
        # First I cancel  receptions related to this order if order shipped.
        po_edit_with_user.picking_ids.action_cancel()
        # Now I am able to cancel purchase order.
        po_edit_with_user.button_cancel()
        # I check that order is cancelled.
        self.assertEqual(po_edit_with_user.state, 'cancel', 'Purchase: PO state should be "Cancel')

    def test_01_run_schedular_flow(self):
        """ Test procurement run schedular."""
        # In order to test the scheduler to generate RFQ, I create a new product
        # Add Buy route
        self.scheduler_product.write({'route_ids': [(4, [self.ref("purchase.route_warehouse0_buy")])]})
        # I create a procurement order.
        procurement = self.Procurement.create({
            'location_id': self.ref('stock.stock_location_stock'),
            'name': 'Test scheduler for RFQ',
            'product_id': self.scheduler_product.id,
            'product_uom': self.ref('product.product_uom_unit'),
            'product_qty': 15,
            })
        # I run the scheduler.
        self.Procurement.run_scheduler()
        # I check Generated RFQ.
        self.assertTrue(procurement.purchase_line_id, 'RFQ should be generated!')
        # I delete the line from the purchase order and check that the move and the procurement are cancelled'''
        procurement.purchase_line_id.unlink()
        self.assertEqual(procurement.state, 'exception', 'Procurement should be in exception')
