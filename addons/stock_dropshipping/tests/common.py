# -*- coding: utf-8 -*-


from odoo.tests import common


class TestStockDropshippingCommon(common.TransactionCase):

    def setUp(self):
        super(TestStockDropshippingCommon, self).setUp()
        #  Model reference
        self.Product = self.env['product.product']
        self.Partner = self.env['res.partner']
        self.ProductCategory = self.env['product.category']
        self.PurchaseOrder = self.env['purchase.order']
        self.SaleOrder = self.env['sale.order']
        self.SaleOrderLine = self.env['sale.order.line']
        self.ProcurementOrder = self.env['procurement.order']
        self.StockWarehouse = self.env['stock.warehouse']
        self.Picking = self.env['stock.picking']
        self.Move = self.env['stock.move']

        # ref id
        self.lifo_removal_strategy_id = self.ref('stock.removal_lifo')
        self.uom_kg_id = self.ref('product.product_uom_kgm')
        self.partner_id = self.ref('base.res_partner_3')
        self.pick_type_out_id = self.ref('stock.picking_type_out')
        self.stock_location_id = self.ref('stock.stock_location_stock')
        self.customer_location_id = self.ref('stock.stock_location_customers')
        self.uom_unit = self.env.ref('product.product_uom_unit')
        self.category_all = self.env.ref('product.product_category_1')

        # Creating Partner with name of Crossdocking supplier
        self.partner = self.Partner.create({'name': "Crossdocking supplier"})

        # Creating Warehouse
        self.warehouse = self.StockWarehouse.create({'name': 'WareHouse PickPackShip',
            'code': 'whpps',
            'reception_steps': 'two_steps',
            'delivery_steps': 'pick_pack_ship', })
