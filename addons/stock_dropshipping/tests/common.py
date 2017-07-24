# -*- coding: utf-8 -*-

from odoo.tests import common


class TestStockDropshippingCommon(common.TransactionCase):

    def _create_sale_order(self, partner_id, product, product_qty, uom_id):
        values = {
            'partner_id': partner_id,
            'note': 'Create sale order for product iPad Retina Display',
            'warehouse_id': self.warehouse.id,
            'pricelist_id': self.ref('product.list0'),
            'order_line': [(0, 0, {
                'product_id': product.id,
                'name': product.name,
                'product_uom_qty': product_qty,
                'product_uom': uom_id
             })]
        }
        return self.SaleOrder.create(values)

    def setUp(self):
        super(TestStockDropshippingCommon, self).setUp()

        #  Model reference
        self.Product = self.env['product.product']
        self.Partner = self.env['res.partner']
        self.PurchaseOrder = self.env['purchase.order']
        self.SaleOrder = self.env['sale.order']
        self.ProcurementOrder = self.env['procurement.order']
        self.Picking = self.env['stock.picking']

        # Useful Reference.
        self.uom_kg_id = self.ref('product.product_uom_kgm')
        self.partner_id = self.ref('base.res_partner_3')
        self.pick_type_out_id = self.ref('stock.picking_type_out')
        self.stock_location_id = self.ref('stock.stock_location_stock')
        self.customer_location_id = self.ref('stock.stock_location_customers')
        self.uom_unit = self.env.ref('product.product_uom_unit')
        self.category_all = self.env.ref('product.product_category_1')

        # Creating partner with name of cross docking supplier.
        self.partner = self.Partner.create({'name': "Cross dock supplier"})

        # Creating Warehouse
        self.warehouse = self.env['stock.warehouse'].create({
            'name': 'WareHouse PickPackShip',
            'code': 'whpps',
            'reception_steps': 'two_steps',
            'delivery_steps': 'ship_only', })
