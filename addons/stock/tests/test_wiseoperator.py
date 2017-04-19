# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo.addons.stock.tests.common2 import TestStockCommon
from odoo.tests import common


class TestWiseOperator(TestStockCommon):

    def setUp(self):
        super(TestWiseOperator, self).setUp()

        #Usefull models
        self.Product = self.env['product.product']
        self.Picking = self.env['stock.picking']

        #Usefull IDs
        self.categ_id = self.ref('product.product_category_1')
        self.partner_id = self.ref('base.res_partner_2')
        self.picking_type_id = self.ref("stock.picking_type_in")
        self.uom_id = self.ref('product.product_uom_unit')
        self.location_id = self.ref("stock.stock_location_suppliers")
        self.location_dest_id = self.ref("stock.stock_location_stock")
        #Create a new stockable product
        self.product_wise = self.Product.create({
            'name': 'Wise Unit',
            'categ_id': self.categ_id,
            'uom_id': self.uom_id,
            'uom_po_id': self.uom_id
            })
        self.pick_wise = self.Picking.create({
            'name': 'Incoming picking (wise unit)',
            'partner_id': self.partner_id,
            'picking_type_id': self.picking_type_id,
            'move_lines': [
                (0, 0,
                    {
                        'product_id': self.product_wise.id,
                        'product_uom_qty': 10.00,
                        'location_id':  self.location_id,
                        'location_dest_id': self.location_dest_id
                    })]
            })
                    
    def test_00_wiseoperator(self):
        self.pick_wise.action_confirm()
        self.pick_wise.do_prepare_partial()
