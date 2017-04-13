# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from common import TestStock


class TestProcurementexception(TestStock):

    def test_procurement_exception(self):
        """ Test procurement exception with dropshiping."""
        self.sale_order_route_dropship01.action_confirm()

        # Checking if there is a procurement in exception that has the procurement group of the sales order created before."""
        self.Procurement.run_scheduler()
        procs = self.Procurement.search([('group_id.name', '=', self.sale_order_route_dropship01.name), ('state', '=', 'exception')])
        self.assertTrue(procs, 'No Procurement!')

        # Setting at least one supplier on the product.
        self.product_with_no_seller.write({'seller_ids': [(0,0, {'delay': 1,
            'name': self.env.ref('base.res_partner_2').id,
            'min_qty': 2.0
            })]})

        # Running the Procurement.
        procs.run()
        state = procs.mapped('state')

        # Checking the status changed there is no procurement order in exception any more from that procurement group."""
        self.assertTrue(state, 'Procurement should be in running state')

        # Checking a purchase quotation was created.
        procs = self.Procurement.search([('group_id.name', '=', self.sale_order_route_dropship01.name)])
        purchase_id = [proc.purchase_line_id.order_id for proc in procs if proc.purchase_line_id]
        self.assertTrue(purchase_id, 'No Purchase Quotation is created')
