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
    def test_00_wiseoperator(self):
        print "--------", self
