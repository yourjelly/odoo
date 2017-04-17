# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests import common


class TestCancellationPropagated(common.TransactionCase):

    def setUp(self):
        super(TestCancellationPropagated, self).setUp()
        #Usefull models
        self.WareHouse = self.env['stock.warehouse']
        self.Product = self.env['product.product']
        self.Bom = self.env['mrp.bom']
        self.SaleOrder = self.env['sale.order']
        self.ProcurementOrder = self.env['procurement.order']
        #Usefull IDs
        self.uom_unit_id = self.ref('product.product_uom_unit')
        self.pricelist_id = self.ref('product.list0')
        self.prod_con_div = self.ref('product.consu_delivery_01')
        self.company_id = self.ref('base.main_company')
        #create a warehouse with pick-pack-ship and reception
        self.wh_pps = self.WareHouse.create({
            'name': 'WareHouse PickPackShip',
            'code': 'whpps',
            'reception_steps': 'two_steps',
            'delivery_steps': 'pick_pack_ship',
            'manufacture_to_resupply': True})
        #new product in this warehouse
        self.product_manu = self.Product.create({
            'name': 'My MTO Product',
            'type': 'product',
            'uom_id': self.uom_unit_id  ,
            'uom_po_id': self.uom_unit_id})
        #create a bom for this product
        self.Bom.create({
            'company_id': self.company_id,
            'product_tmpl_id': self.product_manu.product_tmpl_id.id,
            'product_id': self.product_manu.id,
            'product_uom_id': self.uom_unit_id,
            'product_qty': 1.0,
            'type': 'normal',
            'bom_line_ids': [
                    (0, 0,
                        {
                            'product_id': self.prod_con_div,
                            'product_uom_id': self.uom_unit_id,
                            'product_qty': 1.0,
                        })]
            })
        self.so = self.SaleOrder.create({
            'partner_id': self.ref('base.res_partner_3'),
            'note': 'Create Sales order',
            'warehouse_id': self.wh_pps.id,
            'pricelist_id': self.pricelist_id,
            'order_line': [
                    (0, 0,
                        {
                            'product_id': self.product_manu.id,
                            'name': "product_manu",
                            'product_uom_qty': 5.00,
                            'product_uom': self.uom_unit_id
                        })]
          })

    def test_00_cancellation_propagated(self):
        #set routes on product to be MTO and manufacture
        route_wh_mfc_id = self.env.ref('stock.warehouse0').manufacture_pull_id.route_id.id
        route_wh_mto_id = self.env.ref('stock.warehouse0').mto_pull_id.route_id.id
        self.product_manu.write({'route_ids': [(6, 0, [route_wh_mto_id, route_wh_mfc_id])]})
        #Confirm sales order
        self.so.action_confirm()
        #run scheduler
        self.ProcurementOrder.run_scheduler()
        #Retrieve related procu
        procus = self.ProcurementOrder.search([('group_id.name', '=', self.so.name)])
        self.assertGreater(len(procus.ids), 0, 'No procurements are found for sale order')# "%s"' %(self.so.name, self.so.id))
        for procu in procus:
            self.assertEqual(procu.state, u'running', 'Procurement with should be running but is with a state')
        # Check that one production order exist
        prodor_ids = [proc.production_id for proc in procus if proc.production_id]
        self.assertGreater(len(prodor_ids), 0, 'No production order found ')
        # Cancel the main procurement
        procurement = self.ProcurementOrder.search([('origin', '=', self.so.name)])
        self.assertEqual(len(procurement.ids), 1, 'Main procurement not identified')
        procurement.cancel()
        self.assertEqual(procurement.state, 'cancel', 'Main procurement should be cancelled')
        # Check that all procurements related are cancelled
        for procu in procus:
            self.assertEqual(procu.state, 'cancel', 'Procurement with  should be with the state cancel but is with a state')
        # Check that the production order is cancelled
        for prodor in self.env['mrp.production'].browse([prodor.id for prodor in prodor_ids]):
            self.assertEqual(prodor.state, 'cancel', 'Production order should be cancelled')
