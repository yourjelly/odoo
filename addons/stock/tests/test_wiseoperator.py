# -*- coding: utf-8 -*-

from odoo.tests import common


class TestWiseOperator(common.TransactionCase):

    def setUp(self):
        super(TestWiseOperator, self).setUp()

        self.product = self.env['product.product']
        self.product_category_1 = self.ref('product.product_category_1')
        self.product_uom_unit = self.ref('product.product_uom_unit')
        self.stock_picking = self.env['stock.picking']
        self.res_partner_2 = self.ref('base.res_partner_2')
        self.picking_type_out = self.ref('stock.picking_type_out')
        self.stock_location_suppliers = self.ref('stock.stock_location_suppliers')
        self.stock_location_stock = self.ref('stock.stock_location_stock')
        self.stock_location_customers = self.ref('stock.stock_location_customers')
        self.quant_package = self.env['stock.quant.package']
        self.stock_location_components = self.ref('stock.stock_location_components')
        self.pack_operation = self.env['stock.pack.operation']
        self.stock_location_14 = self.ref('stock.stock_location_14')
        self.stock_quant = self.env['stock.quant']
        self.res_partner_4 = self.ref('base.res_partner_4')

    def test_00_wiseoperator(self):

        # Create a new stockable product
        self.product_wise = self.product.create({
            'name': 'Wise Unit',
            'type': 'product',
            'categ_id': self.product_category_1,
            'uom_id': self.product_uom_unit,
            'uom_po_id': self.product_uom_unit
        })

        # Create an incoming picking for this product of 10 PCE from suppliers to stock
        self.pick1_wise = self.stock_picking.create({
            'name': 'Incoming picking (wise unit)',
            'partner_id': self.res_partner_2,
            'picking_type_id': self.picking_type_out,
            'location_id': self.stock_location_suppliers,
            'location_dest_id': self.stock_location_stock,
            'move_lines': [(0, 0, {
                'product_id': self.product_wise.id,
                'name': self.product_wise.name,
                'product_uom_qty': 10.00,
                'location_id': self.stock_location_suppliers,
                'location_dest_id': self.stock_location_stock,
                'product_uom': self.product_uom_unit,
            })],
        })

        # Confirm and assign picking and prepare partial
        self.pick1_wise.action_confirm()
        self.pick1_wise.do_prepare_partial()

        # Put 6 pieces in shelf1 and 4 pieces in shelf2
        self.package1 = self.quant_package.create({'name': 'Pack 1'})
        self.pick1_wise.pack_operation_ids[0].write({
            'result_package_id': self.package1.id,
            'product_qty': 4,
            'location_dest_id': self.stock_location_components
        })

        self.pack_operation.create({
            'product_id': self.product_wise.id,
            'product_uom_id': self.product_uom_unit,
            'picking_id': self.pick1_wise.id,
            'product_qty': 6.0,
            'location_id': self.stock_location_suppliers,
            'location_dest_id': self.stock_location_14
        })

        # Transfer the receipt
        self.pick1_wise.do_transfer()

        # Check the system created 2 quants
        self.records = self.stock_quant.search([('product_id', '=', self.product_wise.id)])
        self.assertEqual(len(self.records.ids), 2, "The number of quants created is not correct")

        # Make a delivery order of 5 pieces to the customer
        self.delivery_order_wise1 = self.stock_picking.create({
            'name': 'outgoing picking 1 (wise unit)',
            'partner_id': self.res_partner_4,
            'picking_type_id': self.picking_type_out,
            'location_id': self.stock_location_stock,
            'location_dest_id': self.stock_location_customers,
            'move_lines': [(0, 0, {
                'product_id': self.product_wise.id,
                'name': self.product_wise.name,
                'product_uom_qty': 5.00,
                'location_id': self.stock_location_stock,
                'location_dest_id': self.stock_location_customers,
                'product_uom': self.product_uom_unit
            })]
        })

        # Assign and confirm
        self.delivery_order_wise1.action_confirm()
        self.delivery_order_wise1.action_assign()

        # Make a delivery order of 5 pieces to the customer
        self.delivery_order_wise2 = self.stock_picking.create({
            'name': 'outgoing picking 2 (wise unit)',
            'partner_id': self.res_partner_4,
            'picking_type_id': self.picking_type_out,
            'location_id': self.stock_location_stock,
            'location_dest_id': self.stock_location_customers,
            'move_lines': [(0, 0, {
                'product_id': self.product_wise.id,
                'name': self.product_wise.name,
                'product_uom_qty': 5.00,
                'location_id': self.stock_location_stock,
                'location_dest_id': self.stock_location_customers,
                'product_uom': self.product_uom_unit,
            })]
        })

        # Assign and confirm
        self.delivery_order_wise2.action_confirm()
        self.delivery_order_wise2.action_assign()

        # The operator is a wise guy and decides to do the opposite of what Odoo proposes.  He uses the products reserved on picking 1 on picking 2 and vice versa
        self.picking1 = self.stock_picking.browse(self.delivery_order_wise1.id)
        self.picking2 = self.stock_picking.browse(self.delivery_order_wise2.id)
        self.pack_ids1 = [x.id for x in self.picking1.pack_operation_ids]
        self.pack_ids2 = [x.id for x in self.picking2.pack_operation_ids]
        self.pack_operation.browse(self.pack_ids1).write({'picking_id': self.picking2.id})
        self.pack_operation.browse(self.pack_ids2).write({'picking_id': self.picking1.id})

        # The recompute remaining qtys does not take into account that pack operations change picking
        self.stock_mv_op_link = self.env['stock.move.operation.link']
        self.links = self.stock_mv_op_link.search([('operation_id', 'in', self.pack_ids1 + self.pack_ids2)])
        self.links.unlink()

        # Process this picking
        self.delivery_order_wise1.do_transfer()

        # Check there was no negative quant created by this picking
        self.records = self.stock_quant.search([('product_id', '=', self.product_wise.id), ('qty', '<', 0.0)])
        self.assertEqual(len(self.records.ids), 0, 'This should not have created a negative quant')

        # Check the other delivery order has changed its state back to partially available
        self.assertEqual(self.delivery_order_wise2.state, 'partially_available', "Delivery order 2 should be back in confirmed state")

        # Process the second picking
        self.delivery_order_wise2.do_transfer()

        # Check all quants are in Customers and there are no negative quants anymore
        self.records = self.stock_quant.search([('product_id','=',self.product_wise.id)])
        self.assertTrue(all([x.location_id.id==self.stock_location_customers and x.qty > 0.0 for x in self.records]), 'Wrong location detected')
