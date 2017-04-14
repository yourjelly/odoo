# -*- coding: utf-8 -*-

from odoo.addons.stock.tests import common2


class TestStockDropshippingCommon(common2.TestStockCommon):

    @classmethod
    def setUpClass(cls):
        super(TestStockDropshippingCommon, cls).setUpClass()
        #  Model reference
        cls.Product = cls.env['product.product']
        cls.ProductCategory = cls.env['product.category']
        cls.PurchaseOrder = cls.env['purchase.order']
        cls.Picking = cls.env['stock.picking']
        cls.Move = cls.env['stock.move']
        # ref id
        cls.lifo_removal_strategy_id = cls.env.ref('stock.removal_lifo').id
        cls.uom_kg_id = cls.emv.ref('product.product_uom_kgm').id
        cls.partner_id = cls.env.ref('base.res_partner_3').id
        cls.pick_type_out_id = cls.env.ref('stock.picking_type_out').id
        cls.stock_location_id = cls.env.ref('stock.stock_location_stock').id
        cls.customer_location_id = cls.env.ref('stock.stock_location_customers').id

