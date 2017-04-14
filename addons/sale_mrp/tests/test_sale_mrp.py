# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests import common
import time


class TestSaleMrp(common.TransactionCase):

    def setUp(self):
        super(TestSaleMrp, self).setUp()

        # Useful models
        self.ProductCategory = self.env['product.category']
        self.Product = self.env['product.product']
        self.MrpBom = self.env['mrp.bom']
        self.SaleOrder = self.env['sale.order']
        self.ProcurementOrder = self.env['procurement.order']
        self.Manufacture = self.env['mrp.production']

        # Reference
        self.warehouse = self.env.ref('stock.warehouse0')
        self.uom_id = self.ref('product.product_uom_unit')
        self.partner_id = self.ref('base.res_partner_2')
        self.pricelist_id = self.ref('product.list0')

    def test_sale_mrp(self):
        """ Test the sale_mrp module in odoo, I start by creating a new product 'Slider Mobile'. """
        self.product_category = self.ProductCategory.create({'name': 'Mobile Products Sellable'})
        self.product_mnf = self.Product.create({
            'categ_id': self.product_category.id,
            'list_price': 200.0,
            'name': 'Slider Mobile',
            'standard_price': 189.0,
            'type': 'product',
            'uom_id': self.uom_id,
            'uom_po_id': self.uom_id
            })

        # Set route on product.
        route_manufacture_id = self.warehouse.manufacture_pull_id.route_id.id
        route_mto_id = self.warehouse.mto_pull_id.route_id.id
        self.product_mnf.write({'route_ids': [(6, 0, [route_manufacture_id, route_mto_id])]})

        # Create bill of material.
        self.MrpBom = self.MrpBom.create({
            'product_tmpl_id': self.product_mnf.product_tmpl_id.id,
            'product_id': self.product_mnf.id,
            'product_qty': 1.0,
            'product_uom_id': self.uom_id,
            'sequence': 0
        })

        # Create Sale Order.
        self.sale_order = self.SaleOrder.create({
            'client_order_ref': 'ref1',
            'date_order': time.strftime("%Y-%m-%d"),
            'partner_id': self.partner_id,
            'order_line': [
                (0, 0, {
                    'product_id': self.product_mnf.id,
                    'name': 'Slider Mobile',
                    'price_unit': 200.0,
                    'product_uom': self.product_mnf.uom_id.id,
                    'product_uom_qty': 500.0
                })],
            'picking_policy': 'direct',
            'pricelist_id': self.pricelist_id
            })

        # I confirm the sale order
        self.sale_order.action_confirm()

        # I verify that a procurement has been generated for sale order and Then I click on the "Run Procurement" button
        procs = self.ProcurementOrder.search([('origin', '=', self.sale_order.name)])
        self.assertTrue(procs, 'No Procurements!')
        procs.run()

        # Check that all procurement are running
        for procu in procs:
            self.assertEqual(procu.state, 'running', 'Procurement with id %d should be with a state "running" but is with a state : %s!' % (procu.id, procu.state))

        # I verify that a manufacturing order has been generated, and that its name and reference are correct
        production_order = self.Manufacture.search([('origin', 'like', self.sale_order.name)], limit=1)
        self.assertTrue(production_order, 'Manufacturing order has not been generated')
        self.assertEqual(production_order.sale_name, self.sale_order.name, 'Wrong Name for the Manufacturing Order. Expected %s, Got %s' % (self.sale_order.name, production_order.sale_name))
        self.assertEqual(production_order.sale_ref, self.sale_order.client_order_ref, 'Wrong Sale Reference for the Manufacturing Order')
