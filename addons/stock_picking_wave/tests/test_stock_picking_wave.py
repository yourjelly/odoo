# -*- coding: utf-8 -*-


from odoo.tests import common


class TestStockPickingWave(common.TransactionCase):

    def setUp(self):
        super(TestStockPickingWave, self).setUp()

        # Usefull models
        self.Product = self.env['product.product']
        # self.SaleOrder = self.env['sale.order']
        self.StockPickingWave = self.env['stock.picking.wave']
        self.StockPicking = self.env['stock.picking']
        self.Move = self.env['stock.move']
        # UseFull Reference
        self.partner_id = self.ref('base.res_partner_2')
        # self.wave_ids = self.env.ref('stock_picking_wave_freeze')
        self.uom_unit = self.env.ref('product.product_uom_unit')
        self.product = self.env.ref('product.product_product_24')
        self.categ_id = self.ref('product.product_category_1')
        self.uom_kgm_id = self.ref('product.product_uom_kgm')
        self.uom_gram_id = self.ref('product.product_uom_gram')
        self.pick_type_id = self.ref('stock.picking_type_out')
        self.stock_location_id = self.ref('stock.stock_location_stock')
        self.stock_location_dest_id = self.ref('stock.stock_location_output')


    def test_00_test_picking(self):

        # Create product1 with Qty=100
        self.product_1 = self.Product.create({
            'name': 'Product_1',
            'type': 'product',
            'categ_id': self.categ_id,
            'list_price': 100.0,
            'standard_price': 70.0,
            'uom_id': self.uom_kgm_id,
            'uom_po_id': self.uom_gram_id,
            'seller_ids': [(0, 0, {'delay': 1, 'name': self.partner_id, 'min_qty': 100})],
            })
        # Create product2 with Qty=0
        self.product_2 = self.Product.create({
            'name': 'Product_2',
            'type': 'product',
            'categ_id': self.categ_id,
            'list_price': 150.0,
            'standard_price': 90.0,
            'uom_id': self.uom_kgm_id,
            'uom_po_id': self.uom_gram_id,
            'seller_ids': [(0, 0, {'delay': 1, 'name': self.partner_id, 'min_qty': 0})],
            })
        # Create picking
        self.picking1 = self.StockPicking.create({
            'name': 'Picking_1',
            'move_type': 'direct',
            'priority': '1',
            'wave_id': self.pickingwave1.id,
            'picking_type_id': self.pick_type_id,
            'location_id': self.stock_location_id,
            'location_dest_id': self.stock_location_dest_id,
            })
        # create outgoing shipment
        self.outgoing_shipment_product1= self.Move.create({
            'name': 'a move',
            'picking_id': self.picking1.id,
            'product_id': self.product_1.id,
            'product_uom': self.uom_kgm_id,
            'location_id':  self.stock_location_id,
            'location_dest_id': self.stock_location_dest_id,
            'product_uom_qty': 20.0,
            'picking_type_id': self.pick_type_id})
       # Create picking
        self.picking2 = self.StockPicking.create({
            'name': 'Picking_2',
            'move_type': 'direct',
            'priority': '2',
            'wave_id': self.pickingwave1.id,
            'picking_type_id': self.pick_type_id,
            'location_id': self.stock_location_id,
            'location_dest_id': self.stock_location_dest_id,
            })
         # create outgoing shipment
        self.outgoing_shipment_product2= self.Move.create({
            'name': 'a move',
            'picking_id': self.picking2.id,
            'product_id': self.product_1.id,
            'product_uom': self.uom_kgm_id,
            'location_id':  self.stock_location_id,
            'location_dest_id': self.stock_location_dest_id,
            'product_uom_qty': 00.0,
            'picking_type_id': self.pick_type_id})
