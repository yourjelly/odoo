# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests import common


class TestCancellationPropagated(common.TransactionCase):

    def setUp(self):
        super(TestCancellationPropagated, self).setUp()
        #create a warehouse with pick-pack-ship and reception
        self.wh_pps = self.env['stock.warehouse'].create({
            'name': 'WareHouse PickPackShip',
            'code': 'whpps',
            'reception_steps': 'two_steps',
            'delivery_steps': 'pick_pack_ship',
            'manufacture_to_resupply': 'True'})
        #new product in this warehouse
        self.uom_id = self.env.ref('product.product_uom_unit')
        self.uom_po_id = self.env.ref('product.product_uom_unit')
        self.product_manu = self.env['product.product'].create({
            'name': 'My MTO Product',
            'type': 'product',
            'uom_id': self.uom_id.id,
            'uom_po_id': self.uom_po_id.id})
        #create a bom for this product
        self.company_id = self.env.ref('base.main_company')
        self.product_uom_id = self.env.ref('product.product_uom_unit')
        self.product_id1 = self.env.ref('product.consu_delivery_01')
        self.product_uom_id1 = self.env.ref('product.product_uom_unit')
        self.mrp_bom_test1 = self.env['mrp.bom'].create({
            'company_id': self.company_id.id,
            'product_tmpl_id': self.product_manu.product_tmpl_id.id,
            'product_id': self.product_manu.id,
            'product_uom_id': self.product_uom_id.id,
            'product_qty': 1.0,
            'type': 'normal',
            'bom_line_ids': [
                    (0, 0,
                        {
                            'product_id': self.product_id1.id,
                            'product_uom_id': self.product_uom_id.id,
                            'product_qty': 1.0,
                        })]
            })
        self.product_uom = self.env.ref('product.product_uom_unit')
        self.sale_order_product_manu = self.env['sale.order'].create({
            'partner_id': self.env.ref('base.res_partner_3').id,
            'note': 'Create Sales order',
            'warehouse_id': self.wh_pps.id,
            'pricelist_id': self.env.ref('product.list0').id,
            'order_line': [
                    (0, 0,
                        {
                            'product_id': self.product_manu.id,
                            'name': "product_manu",
                            'product_uom_qty': 5.00,
                            'product_uom': self.product_uom.id
                        })] 
          })

    def test_00_cancellation_propagated(self):
        # And set routes on product to be MTO and manufacture
        route_warehouse0_manufacture_id = self.env.ref('stock.warehouse0').manufacture_pull_id.route_id.id
        route_warehouse0_mto_id = self.env.ref('stock.warehouse0').mto_pull_id.route_id.id
        self.product_manu.write({'route_ids': [(6, 0, [route_warehouse0_mto_id, route_warehouse0_manufacture_id])]})
        #Confirm sales order
        self.sale_order_product_manu.action_confirm()
        #run scheduler
        self.env['procurement.order'].run_scheduler()
        #Retrieve related procu
        procus = self.env['procurement.order'].search([('group_id.name', '=', self.sale_order_product_manu.name)])
        self.assertGreater(len(procus.ids),0, 'No procurements are found for sale order "%s" (with id : %d)' %(self.sale_order_product_manu.name, self.sale_order_product_manu.id))
        for procu in procus:
            assert procu.state == u'running', 'Procurement with id %d should be "running" but is with a state : %s!' %(procu.id, procu.state)
        # Check that one production order exist
        prodor_ids = [proc.production_id for proc in procus if proc.production_id]
        self.assertGreater(len(prodor_ids),0, 'No production order found !')
        # Cancel the main procurement
        main_procu = self.env['procurement.order'].search([('origin', '=', self.sale_order_product_manu.name)])
        assert len(main_procu.ids) == 1, 'Main procurement not identified !'
        main_procu.cancel()    
        assert main_procu[0].state == u'cancel', 'Main procurement should be cancelled !'
        # Check that all procurements related are cancelled    
        for procu in procus:
            assert procu.state == u'cancel', 'Procurement with id %d should be with the state "cancel" but is with a state : %s!' %(procu.id, procu.state)
        # Check that the production order is cancelled                                                                                     
        for prodor in self.env['mrp.production'].browse([prodor.id for prodor in prodor_ids]):
            assert prodor.state == u'cancel', 'Production order %d should be cancelled but is in state : %s!' %(prodor.id, prodor.state)
