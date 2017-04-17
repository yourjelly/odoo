# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests import common


class TestProcurementexception(common.TransactionCase):

    def setUp(self):
        super(TestProcurementexception, self).setUp()

        # usefull models
        self.procurement = self.env['procurement.order']
        self.product = self.env['product.product']
        self.sale = self.env['sale.order']

        # usefull ids
        self.invoice_id = self.ref('base.res_partner_address_3')
        self.category = self.ref('product.product_category_1')
        self.payment_term_id = self.ref('account.account_payment_term')
        self.patner_id = self.ref('base.res_partner_2')
        self.route_id = self.ref('stock_dropshipping.route_drop_shipping')
        self.uom_unit_id = self.ref('product.product_uom_unit')

        # create a product with no supplier define for it.
        self.product_with_no_seller = self.product.create({
            'name': 'product with no seller',
            'list_price': 20.00,
            'standard_price': 15.00,
            'categ_id': self.category
            })

        # create a sales order with this product with route dropship.
        self.sale_order_route_dropship01 = self.sale.create({
                'partner_id': self.patner_id,
                'partner_invoice_id': self.invoice_id,
                'partner_shipping_id': self.invoice_id,
                'note': 'crossdock route',
                'payment_term_id': self.payment_term_id,
                'order_line': [(0, 0, {
                    'product_id': self.product_with_no_seller.id,
                    'product_uom_qty': 1,
                    'route_id': self.route_id,
                    'product_uom': self.uom_unit_id
                  })]
               })

    def test_procurement_exception(self):
        """ Test cancelation propogation """

        # confirm the sales order.
        self.sale_order_route_dropship01.action_confirm()

        # check there is a procurement in exception that has the procurement group of the sales order created before.
        self.procurement.run_scheduler()
        procs = self.procurement.search([('group_id.name', '=', self.sale_order_route_dropship01.name), ('state', '=', 'exception')])
        self.assertTrue(procs, 'No Procurement!')

        # set the at least one supplier on the product.
        so_product_id = self.sale_order_route_dropship01.order_line.product_id
        self.product_with_no_seller = so_product_id.write({
            'seller_ids': [(0, 0, {
                            'delay': 1,
                            'name': self.patner_id,
                            'min_qty': 2.0
                            })]
                        })

        # run the Procurement.
        procs.run()

        # After run the procurement check the status changed there is no procurement order in exception any more from that procurement group
        procs2 = self.procurement.search([('group_id.name', '=', self.sale_order_route_dropship01.name), ('state', '=', 'exception')])
        self.assertFalse(procs2, 'Procurement should be in running state')

        # check a purchase quotation was created.
        purchase_id = [proc.purchase_line_id.order_id for proc in procs if proc.purchase_line_id]
        self.assertTrue(purchase_id, 'No Purchase Quotation is created')
