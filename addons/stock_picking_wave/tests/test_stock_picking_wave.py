# -*- coding: utf-8 -*-


from odoo.tests import common


class TestStockPickingWave(common.TransactionCase):

    def setUp(self):
        super(TestStockPickingWave, self).setUp()

        # Usefull models
        self.Product = self.env['product.product']
        self.SaleOrder = self.env['sale.order']
        self.StockPickingWave = self.env['stock.picking.wave']
        # UseFull Reference
        self.partner_id = self.ref('base.res_partner_2')
        self.uom_unit = self.env.ref('product.product_uom_unit')
        self.product = self.env.ref('product.product_product_24')

    def test_00_test_picking(self):

        # Create SaleOrder
        self.sale_order_1 = self.SaleOrder.create({
            'partner_id': self.partner_id,
            'picking_policy': 'direct',
            'order_line': [(0, 0, {'product_id': self.product.id, 'product_uom_qty': 200,'product_uom': self.uom_unit.id,'price_unit': 1.00})],
        })
        self.sale_order_2 = self.SaleOrder.create({
            'partner_id': self.partner_id,
            'picking_policy': 'direct',
            'order_line': [(0, 0, {'product_id': self.product.id, 'product_uom_qty': 300,'product_uom': self.uom_unit.id,'price_unit': 1.00})],
        # Confirm sale order
        sale_order_1.action_confirm()
