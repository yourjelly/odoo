# -*- coding: utf-8 -*-

from odoo.tests import common


class TestStockDropshippingCommon(common.TransactionCase):

    def setUp(self):
        super(TestStockDropshippingCommon, self).setUp()
        self.Partner = self.env['res.partner']
        self.Product = self.env['product.product']
        self.SaleOrder = self.env['sale.order']
        self.SaleOrderLine = self.env['sale.order.line']
        self.ProcurementOrder = self.env['procurement.order']
        self.PurchaseOrder = self.env['purchase.order']
        self.StockWarehouse = self.env['stock.warehouse']
        self.ProductCategory = self.env.ref('product.product_category_1')
        self.uom_unit = self.env.ref('product.product_uom_unit')

        # Creating Partner with name of Crossdocking supplier
        self.partner = self.Partner.create({'name': "Crossdocking supplier"})

        # Creating Warehouse
        self.warehouse = self.StockWarehouse.create({'name': 'WareHouse PickPackShip',
            'code': 'whpps',
            'reception_steps': 'two_steps',
            'delivery_steps': 'pick_pack_ship', })

        # Creating Product
        self.product = self.Product.create({'name': "PCE",
                                            'list_price': 100.0,
                                            'standard_price': 70.0,
                                            'type': "product",
                                            'categ_id': self.ProductCategory.id,
                                            'seller_ids': [(0, 0, {'delay': 1, 'name': self.partner.id, 'min_qty': 2.0})],
                                            'uom_id': self.uom_unit.id,
                                            'uom_po_id': self.uom_unit.id, })
