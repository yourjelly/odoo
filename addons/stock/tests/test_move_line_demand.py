# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests import Form
from odoo.tests.common import SavepointCase


class TestMoveLineDemand(SavepointCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.partner = cls.env['res.partner'].create({'name': 'Partner'})
        cls.stock_location = cls.env.ref('stock.stock_location_stock')
        cls.customer_location = cls.env.ref('stock.stock_location_customers')
        cls.uom_unit = cls.env.ref('uom.product_uom_unit')
        cls.uom_dozen = cls.env.ref('uom.product_uom_dozen')
        cls.product = cls.env['product.product'].create({
            'name': 'Product A',
            'type': 'product',
            'categ_id': cls.env.ref('product.product_category_all').id,
        })
        cls.product_b = cls.env['product.product'].create({
            'name': 'Product B',
            'type': 'product',
            'categ_id': cls.env.ref('product.product_category_all').id,
        })
        cls.product_c = cls.env['product.product'].create({
            'name': 'Product C',
            'type': 'product',
            'categ_id': cls.env.ref('product.product_category_all').id,
        })
        cls.product_serial = cls.env['product.product'].create({
            'name': 'Product A',
            'type': 'product',
            'tracking': 'serial',
            'categ_id': cls.env.ref('product.product_category_all').id,
        })
        cls.product_lot = cls.env['product.product'].create({
            'name': 'Product A',
            'type': 'product',
            'tracking': 'lot',
            'categ_id': cls.env.ref('product.product_category_all').id,
        })

    def test_internal_notracking_1(self):
        """slide 1-4"""
        shelf1_location = self.env['stock.location'].create({
            'name': 'shelf1',
            'usage': 'internal',
            'location_id': self.stock_location.id,
        })
        self.env['stock.quant'].with_context(inventory_mode=True).create({
            'product_id': self.product.id,
            'location_id': self.stock_location.id,
            'quantity': 5,
        })
        internal = Form(self.env['stock.picking'])
        internal.partner_id = self.partner
        internal.picking_type_id = self.env.ref('stock.picking_type_internal')
        with internal.move_ids_without_package.new() as move:
            move.product_id = self.product
            move.product_uom_qty = 5
        internal = internal.save()
        internal.action_confirm()
        internal.action_assign()

        # demand - reserved -   from -     to - done
        #      5 -        5 -  stock -  stock -    0
        self.assertEqual(internal.move_line_ids_without_package.demand_qty, 5)
        self.assertEqual(internal.move_line_ids_without_package.product_uom_qty, 5)
        self.assertEqual(internal.move_line_ids_without_package.location_dest_id, self.stock_location)

        # demand - reserved -   from -     to - done
        #      3 -        5 -  stock - shelf1 -    3
        #      2 -        0 -  stock -  stock -    0
        internal = Form(internal, view='stock.view_picking_form')
        with internal.move_line_ids_without_package.edit(0) as move_line:
            move_line.qty_done = 3
            move_line.location_dest_id = shelf1_location
        internal = internal.save()
        self.assertEqual(len(internal.move_line_ids_without_package), 2)
        self.assertEqual(internal.move_line_ids_without_package[0].demand_qty, 3)
        self.assertEqual(internal.move_line_ids_without_package[0].product_uom_qty, 5)
        self.assertEqual(internal.move_line_ids_without_package[0].location_dest_id, shelf1_location)
        self.assertEqual(internal.move_line_ids_without_package[0].qty_done, 3)
        self.assertEqual(internal.move_line_ids_without_package[1].demand_qty, 2)
        self.assertEqual(internal.move_line_ids_without_package[1].product_uom_qty, 0)
        self.assertEqual(internal.move_line_ids_without_package[1].location_dest_id, self.stock_location)
        self.assertEqual(internal.move_line_ids_without_package[1].qty_done, 0)

        # demand - reserved -   from -     to - done
        #      3 -        5 -  stock - shelf1 -    3
        #      2 -        0 -  stock -  stock -    2
        internal = Form(internal, view='stock.view_picking_form')
        with internal.move_line_ids_without_package.edit(1) as move_line:
            move_line.qty_done = 2
        internal = internal.save()
        self.assertEqual(len(internal.move_line_ids_without_package), 2)
        self.assertEqual(internal.move_line_ids_without_package[0].demand_qty, 3)
        self.assertEqual(internal.move_line_ids_without_package[0].product_uom_qty, 5)
        self.assertEqual(internal.move_line_ids_without_package[0].location_dest_id, shelf1_location)
        self.assertEqual(internal.move_line_ids_without_package[0].qty_done, 3)
        self.assertEqual(internal.move_line_ids_without_package[1].demand_qty, 2)
        self.assertEqual(internal.move_line_ids_without_package[1].product_uom_qty, 0)
        self.assertEqual(internal.move_line_ids_without_package[1].location_dest_id, self.stock_location)
        self.assertEqual(internal.move_line_ids_without_package[1].qty_done, 2)

    def test_internal_notracking_2(self):
        """slide 5-7"""
        shelf1_location = self.env['stock.location'].create({
            'name': 'shelf1',
            'usage': 'internal',
            'location_id': self.stock_location.id,
        })
        shelf2_location = self.env['stock.location'].create({
            'name': 'shelf2',
            'usage': 'internal',
            'location_id': self.stock_location.id,
        })
        self.env['stock.quant'].with_context(inventory_mode=True).create({
            'product_id': self.product.id,
            'location_id': shelf1_location.id,
            'quantity': 3,
        })
        internal = Form(self.env['stock.picking'])
        internal.partner_id = self.partner
        internal.picking_type_id = self.env.ref('stock.picking_type_internal')
        with internal.move_ids_without_package.new() as move:
            move.product_id = self.product
            move.product_uom_qty = 5
        internal = internal.save()
        internal.action_confirm()
        # demand - reserved -   from -     to - done
        #      5 -        0 -  stock -  stock -    0
        internal.action_assign()

        # demand - reserved -   from -     to - done
        #      3 -        3 -  shelf1-  stock -    0
        #      2 -        0 -  stock -  stock -    0
        self.assertEqual(len(internal.move_line_ids_without_package), 2)
        self.assertEqual(internal.move_line_ids_without_package[0].demand_qty, 3)
        self.assertEqual(internal.move_line_ids_without_package[0].product_uom_qty, 3)
        self.assertEqual(internal.move_line_ids_without_package[0].location_id, shelf1_location)
        self.assertEqual(internal.move_line_ids_without_package[0].location_dest_id, self.stock_location)
        self.assertEqual(internal.move_line_ids_without_package[1].demand_qty, 2)
        self.assertEqual(internal.move_line_ids_without_package[1].product_uom_qty, 0)
        self.assertEqual(internal.move_line_ids_without_package[1].location_id, self.stock_location)
        self.assertEqual(internal.move_line_ids_without_package[1].location_dest_id, self.stock_location)

        # demand - reserved -   from -     to - done
        #      3 -        3 -  shelf1-  shelf2-    3
        #      2 -        0 -  stock -  stock -    0
        internal = Form(internal, view='stock.view_picking_form')
        with internal.move_line_ids_without_package.edit(0) as move_line:
            move_line.qty_done = 3
            move_line.location_dest_id = shelf2_location
        internal = internal.save()
        self.assertEqual(len(internal.move_line_ids_without_package), 2)
        self.assertEqual(internal.move_line_ids_without_package[0].demand_qty, 3)
        self.assertEqual(internal.move_line_ids_without_package[0].product_uom_qty, 3)
        self.assertEqual(internal.move_line_ids_without_package[0].location_id, shelf1_location)
        self.assertEqual(internal.move_line_ids_without_package[0].location_dest_id, shelf2_location)
        self.assertEqual(internal.move_line_ids_without_package[0].qty_done, 3)
        self.assertEqual(internal.move_line_ids_without_package[1].demand_qty, 2)
        self.assertEqual(internal.move_line_ids_without_package[1].product_uom_qty, 0)
        self.assertEqual(internal.move_line_ids_without_package[1].location_id, self.stock_location)
        self.assertEqual(internal.move_line_ids_without_package[1].location_dest_id, self.stock_location)
        self.assertEqual(internal.move_line_ids_without_package[1].qty_done, 0)

    def test_internal_notracking_3(self):
        """Play with move line's removals"""
        self.env['stock.quant'].with_context(inventory_mode=True).create({
            'product_id': self.product.id,
            'location_id': self.stock_location.id,
            'quantity': 3,
        })
        internal = Form(self.env['stock.picking'])
        internal.partner_id = self.partner
        internal.picking_type_id = self.env.ref('stock.picking_type_internal')
        with internal.move_ids_without_package.new() as move:
            move.product_id = self.product
            move.product_uom_qty = 3
        internal = internal.save()
        internal.action_confirm()
        internal.action_assign()

        # demand - reserved -   from -     to - done
        #      3 -        3 -  stock -  stock -    0

        # demand - reserved -   from -     to - done
        #      1 -        3 -  stock -  stock -    1
        #      2 -        0 -  stock -  stock -    0
        internal = Form(internal, view='stock.view_picking_form')
        with internal.move_line_ids_without_package.edit(0) as move_line:
            move_line.qty_done = 1
        internal = internal.save()

        # demand - reserved -   from -     to - done
        #      1 -        3 -  stock -  stock -    1
        #      1 -        0 -  stock -  stock -    1
        #      1 -        0 -  stock -  stock -    0
        internal = Form(internal, view='stock.view_picking_form')
        with internal.move_line_ids_without_package.edit(1) as move_line:
            move_line.qty_done = 1
        internal = internal.save()

        # demand - reserved -   from -     to - done
        #      1 -        3 -  stock -  stock -    1
        #      1 -        0 -  stock -  stock -    1
        #      1 -        0 -  stock -  stock -    1
        internal = Form(internal, view='stock.view_picking_form')
        with internal.move_line_ids_without_package.edit(2) as move_line:
            move_line.qty_done = 1
        internal = internal.save()

        # unlink the second move line
        # demand - reserved -   from -     to - done
        #      1 -        3 -  stock -  stock -    1
        #      1 -        0 -  stock -  stock -    1
        #      1 -        0 -  stock -  stock -    0
        internal = Form(internal, view='stock.view_picking_form')
        internal.move_line_ids_without_package.remove(1)
        internal = internal.save()
        self.assertEqual(len(internal.move_line_ids_without_package), 3)
        self.assertEqual(internal.move_line_ids_without_package[0].demand_qty, 1)
        self.assertEqual(internal.move_line_ids_without_package[0].product_uom_qty, 3)
        self.assertEqual(internal.move_line_ids_without_package[0].qty_done, 1)

    def test_internal_notracking_4(self):
        """Process partially a move line before unlinking it, check
        we are back to the original situation.
        """
        self.env['stock.quant'].with_context(inventory_mode=True).create({
            'product_id': self.product.id,
            'location_id': self.stock_location.id,
            'quantity': 2,
        })
        internal = Form(self.env['stock.picking'])
        internal.partner_id = self.partner
        internal.picking_type_id = self.env.ref('stock.picking_type_internal')
        with internal.move_ids_without_package.new() as move:
            move.product_id = self.product
            move.product_uom_qty = 2
        internal = internal.save()
        internal.action_confirm()
        internal.action_assign()

        # demand - reserved -   from -     to - done
        #      2 -        2 -  stock -  stock -    0

        # demand - reserved -   from -     to - done
        #      1 -        2 -  stock -  stock -    1
        #      1 -        0 -  stock -  stock -    0
        internal = Form(internal, view='stock.view_picking_form')
        with internal.move_line_ids_without_package.edit(0) as move_line:
            move_line.qty_done = 1
        internal = internal.save()

        # unlink the first move line
        # demand - reserved -   from -     to - done
        #      2 -        2 -  stock -  stock -    0
        internal = Form(internal, view='stock.view_picking_form')
        internal.move_line_ids_without_package.remove(0)
        internal = internal.save()
        self.assertEqual(len(internal.move_line_ids_without_package), 1)

    def test_internal_notracking_5(self):
        """Create an internal transfer using only the stock move lines.
        Change the destination location on the picking, see it changes the default destination
        location on all move lines.
        Add a product tracked by serial number (which is not available in stock) and confirm
        then reserve everything. Valiate without process the last product.
        """
        self.env['stock.quant'].with_context(inventory_mode=True).create({
            'product_id': self.product.id,
            'location_id': self.stock_location.id,
            'quantity': 2,
        })
        self.env['stock.quant'].with_context(inventory_mode=True).create({
            'product_id': self.product_b.id,
            'location_id': self.stock_location.id,
            'quantity': 2,
        })
        self.env['stock.quant'].with_context(inventory_mode=True).create({
            'product_id': self.product_c.id,
            'location_id': self.stock_location.id,
            'quantity': 2,
        })
        internal = Form(self.env['stock.picking'])
        internal.partner_id = self.partner
        internal.picking_type_id = self.env.ref('stock.picking_type_internal')
        with internal.move_line_ids_without_package.new() as move_line:
            move_line.product_id = self.product
            move_line.demand_qty = 2
        with internal.move_line_ids_without_package.new() as move_line:
            move_line.product_id = self.product_b
            move_line.demand_qty = 2
        with internal.move_line_ids_without_package.new() as move_line:
            move_line.product_id = self.product_c
            move_line.demand_qty = 2
        internal = internal.save()

        self.assertEqual(len(internal.move_line_ids_without_package), 3)
        self.assertEqual(internal.move_line_ids_without_package.location_dest_id, self.stock_location)

        # Change the destination location on the picking, it should change it on all the move lines.
        shelf1_location = self.env['stock.location'].create({
            'name': 'shelf1',
            'usage': 'internal',
            'location_id': self.stock_location.id,
        })
        internal = Form(internal)
        internal.location_dest_id = shelf1_location
        internal = internal.save()
        self.assertEqual(internal.move_line_ids_without_package.location_dest_id, shelf1_location)

        # Add an unavailable tracked product.
        internal = Form(internal)
        with internal.move_line_ids_without_package.new() as move_line:
            move_line.product_id = self.product_serial
            move_line.demand_qty = 1
        internal = internal.save()

        internal.action_confirm()
        self.assertEqual(len(internal.move_line_ids_without_package), 4)
        internal.action_assign()
        self.assertEqual(len(internal.move_line_ids_without_package), 4)

        self.assertEqual(internal.state, 'assigned')
        self.assertEqual(
            [m.state for m in internal.move_lines],
            ['assigned', 'assigned', 'assigned', 'confirmed']
        )
        res = internal.button_validate()
        immediate_transfer = Form(self.env['stock.immediate.transfer'].with_context(res['context'])).save()
        res = immediate_transfer.process()
        create_backorder = Form(self.env['stock.backorder.confirmation'].with_context(res['context'])).save()
        res = create_backorder.process_cancel_backorder()
        self.assertEqual(internal.state, 'done')
        self.assertEqual(
            [m.state for m in internal.move_lines],
            ['done', 'done', 'done', 'cancel']
        )

    def test_internal_notracking_6(self):
        """Create an immediate transer using only stock move lines."""
        # demand qty should be invisible?
        internal = Form(self.env['stock.picking'].with_context(default_immediate_transfer=True))
        internal.partner_id = self.partner
        internal.picking_type_id = self.env.ref('stock.picking_type_internal')
        with internal.move_line_ids_without_package.new() as move_line:
            move_line.product_id = self.product
            move_line.demand_qty = 2
        internal = internal.save()
        self.assertTrue(internal.immediate_transfer)
        self.assertEqual(len(internal.move_line_ids_without_package), 1)

    def test_internal_tracking_serial_1(self):
        shelf1_location = self.env['stock.location'].create({
            'name': 'shelf1',
            'usage': 'internal',
            'location_id': self.stock_location.id,
        })
        lot1 = self.env['stock.production.lot'].create({
            'product_id': self.product_serial.id,
            'company_id': self.env.company.id,
        })
        lot2 = self.env['stock.production.lot'].create({
            'product_id': self.product_serial.id,
            'company_id': self.env.company.id,
        })
        self.env['stock.quant'].with_context(inventory_mode=True).create({
            'product_id': self.product_serial.id,
            'location_id': self.stock_location.id,
            'lot_id': lot1.id,
            'quantity': 1,
        })
        self.env['stock.quant'].with_context(inventory_mode=True).create({
            'product_id': self.product_serial.id,
            'location_id': self.stock_location.id,
            'lot_id': lot2.id,
            'quantity': 1,
        })
        internal = Form(self.env['stock.picking'])
        internal.partner_id = self.partner
        internal.picking_type_id = self.env.ref('stock.picking_type_internal')
        with internal.move_ids_without_package.new() as move:
            move.product_id = self.product_serial
            move.product_uom_qty = 2
        internal = internal.save()
        internal.action_confirm()
        # demand - reserved -   from -     to - done
        #      1 -        0 -  stock -  stock -    0
        #      1 -        0 -  stock -  stock -    0
        self.assertEqual(len(internal.move_line_ids_without_package), 2)
        self.assertEqual(internal.move_line_ids_without_package[0].demand_qty, 1)
        self.assertEqual(internal.move_line_ids_without_package[1].demand_qty, 1)
        internal.action_assign()

        # demand - reserved -   from -     to - done
        #      1 -        1 -  stock -  stock -    0 -> lot1
        #      1 -        1 -  stock -  stock -    0 -> lot2
        self.assertEqual(len(internal.move_line_ids_without_package), 2)
        self.assertEqual(internal.move_line_ids_without_package[0].demand_qty, 1)
        self.assertEqual(internal.move_line_ids_without_package[0].product_uom_qty, 1)
        self.assertEqual(internal.move_line_ids_without_package[0].qty_done, 0)
        self.assertEqual(internal.move_line_ids_without_package[0].lot_id, lot1)
        self.assertEqual(internal.move_line_ids_without_package[1].demand_qty,1)
        self.assertEqual(internal.move_line_ids_without_package[1].product_uom_qty, 1)
        self.assertEqual(internal.move_line_ids_without_package[1].qty_done, 0)
        self.assertEqual(internal.move_line_ids_without_package[1].lot_id, lot2)

        # change the source location of the reseved ml
        # demand - reserved -   from -     to - done
        #      1 -        0 -  shelf -  stock -    0 -> lot1
        #      1 -        0 -  shelf -  stock -    0 -> lot2
        internal = Form(internal, view='stock.view_picking_form')
        with internal.move_line_ids_without_package.edit(0) as move_line:
            move_line.location_id = shelf1_location
            move_line.qty_done = 1
        with internal.move_line_ids_without_package.edit(1) as move_line:
            move_line.location_id = shelf1_location
            move_line.qty_done = 1
        internal = internal.save()
        self.assertEqual(len(internal.move_line_ids_without_package), 2)
        self.assertEqual(internal.move_line_ids_without_package[0].demand_qty, 1)
        self.assertEqual(internal.move_line_ids_without_package[0].product_uom_qty, 0)
        self.assertEqual(internal.move_line_ids_without_package[0].qty_done, 1)
        self.assertEqual(internal.move_line_ids_without_package[0].lot_id, lot1)
        self.assertEqual(internal.move_line_ids_without_package[1].demand_qty, 1)
        self.assertEqual(internal.move_line_ids_without_package[1].product_uom_qty, 0)
        self.assertEqual(internal.move_line_ids_without_package[1].qty_done, 1)
        self.assertEqual(internal.move_line_ids_without_package[1].lot_id, lot2)

        # call _action_assign
        # demand - reserved -   from -     to - done
        #      1 -        0 -  shelf -  stock -    0 -> lot1
        #      1 -        0 -  shelf -  stock -    0 -> lot2
        #      0 -        0 -  stock -  stock -    1 -> lot1
        #      0 -        0 -  stock -  stock -    1 -> lot2
        internal.action_assign()
        self.assertEqual(internal.move_line_ids_without_package[0].demand_qty, 0)
        self.assertEqual(internal.move_line_ids_without_package[0].product_uom_qty, 0)
        self.assertEqual(internal.move_line_ids_without_package[0].qty_done, 1)
        self.assertEqual(internal.move_line_ids_without_package[0].lot_id, lot1)
        self.assertEqual(internal.move_line_ids_without_package[1].demand_qty, 0)
        self.assertEqual(internal.move_line_ids_without_package[1].product_uom_qty, 0)
        self.assertEqual(internal.move_line_ids_without_package[1].qty_done, 1)
        self.assertEqual(internal.move_line_ids_without_package[1].lot_id, lot2)
        self.assertEqual(internal.move_line_ids_without_package[2].demand_qty, 1)
        self.assertEqual(internal.move_line_ids_without_package[2].product_uom_qty, 1)
        self.assertEqual(internal.move_line_ids_without_package[2].qty_done, 0)
        self.assertEqual(internal.move_line_ids_without_package[2].lot_id, lot1)
        self.assertEqual(internal.move_line_ids_without_package[3].demand_qty, 1)
        self.assertEqual(internal.move_line_ids_without_package[3].product_uom_qty, 1)
        self.assertEqual(internal.move_line_ids_without_package[3].qty_done, 0)
        self.assertEqual(internal.move_line_ids_without_package[3].lot_id, lot2)

    def test_delivery_tracking_lot_1(self):
        """rerserve partially a lot, process then remove the reserved move line"""
        lot1 = self.env['stock.production.lot'].create({
            'product_id': self.product_lot.id,
            'company_id': self.env.company.id,
        })
        self.env['stock.quant'].with_context(inventory_mode=True).create({
            'product_id': self.product_lot.id,
            'location_id': self.stock_location.id,
            'lot_id': lot1.id,
            'quantity': 1,
        })

        delivery = Form(self.env['stock.picking'])
        delivery.partner_id = self.partner
        delivery.picking_type_id = self.env.ref('stock.picking_type_out')
        with delivery.move_ids_without_package.new() as move:
            move.product_id = self.product_lot
            move.product_uom_qty = 4
        delivery = delivery.save()
        delivery.action_confirm()
        # demand - reserved - done
        #      4 -        0 -    0
        self.assertEqual(delivery.move_line_ids_without_package.demand_qty, 4)
        self.assertEqual(delivery.move_line_ids_without_package.product_uom_qty, 0)
        self.assertEqual(delivery.move_line_ids_without_package.qty_done, 0)

        delivery.action_assign()
        self.assertEqual(delivery.move_lines.state, 'partially_available')

        # demand - reserved - done
        #      1 -        1 -    0
        #      3 -        0 -    0
        self.assertEqual(delivery.move_line_ids_without_package[0].demand_qty, 1)
        self.assertEqual(delivery.move_line_ids_without_package[0].product_uom_qty, 1)
        self.assertEqual(delivery.move_line_ids_without_package[0].qty_done, 0)
        self.assertEqual(delivery.move_line_ids_without_package[1].demand_qty, 3)
        self.assertEqual(delivery.move_line_ids_without_package[1].product_uom_qty, 0)
        self.assertEqual(delivery.move_line_ids_without_package[1].qty_done, 0)

        # demand - reserved - done
        #      1 -        1 -    1
        #      3 -        0 -    0
        delivery = Form(delivery, view='stock.view_picking_form')
        with delivery.move_line_ids_without_package.edit(0) as move_line:
            move_line.qty_done = 1
        delivery = delivery.save()
        self.assertEqual(len(delivery.move_line_ids_without_package), 2)
        self.assertEqual(delivery.move_line_ids_without_package[0].demand_qty, 1)
        self.assertEqual(delivery.move_line_ids_without_package[0].product_uom_qty, 1)
        self.assertEqual(delivery.move_line_ids_without_package[0].qty_done, 1)
        self.assertEqual(delivery.move_line_ids_without_package[1].demand_qty, 3)
        self.assertEqual(delivery.move_line_ids_without_package[1].product_uom_qty, 0)
        self.assertEqual(delivery.move_line_ids_without_package[1].qty_done, 0)

        # Remove the reserved move line.
        # its previous state.
        # demand - reserved - done
        #      4 -        0 -    0
        delivery = Form(delivery, view='stock.view_picking_form')
        delivery.move_line_ids_without_package.remove(0)
        delivery = delivery.save()
        self.assertEqual(delivery.move_line_ids_without_package.demand_qty, 4)
        self.assertEqual(delivery.move_line_ids_without_package.product_uom_qty, 0)
        self.assertEqual(delivery.move_line_ids_without_package.qty_done, 0)

    def test_receipt_tracking_lot_1(self):
        receipt = Form(self.env['stock.picking'])
        receipt.partner_id = self.partner
        receipt.picking_type_id = self.env.ref('stock.picking_type_in')
        with receipt.move_ids_without_package.new() as move:
            move.product_id = self.product_lot
            move.product_uom_qty = 5
        receipt = receipt.save()
        receipt.action_confirm()

        # demand - reserved - lot name - done
        #      5 -        5 -          -    0
        self.assertEqual(receipt.move_line_ids_without_package.demand_qty, 5)
        self.assertEqual(receipt.move_line_ids_without_package.product_uom_qty, 5)
        self.assertEqual(receipt.move_line_ids_without_package.lot_name, False)
        self.assertEqual(receipt.move_line_ids_without_package.qty_done, 0)

        # process 2 lot1 and 3 lot2
        # demand - reserved - lot name - done
        #      2 -        5 -    lot1  -    2
        #      3 -        0 -          -    0
        receipt = Form(receipt, view='stock.view_picking_form')
        with receipt.move_line_ids_without_package.edit(0) as move_line:
            move_line.lot_name = 'lot1'
            move_line.qty_done = 2
        receipt = receipt.save()
        self.assertEqual(len(receipt.move_line_ids_without_package), 2)
        self.assertEqual(receipt.move_line_ids_without_package[0].demand_qty, 2)
        self.assertEqual(receipt.move_line_ids_without_package[0].product_uom_qty, 5)
        self.assertEqual(receipt.move_line_ids_without_package[0].lot_name, 'lot1')
        self.assertEqual(receipt.move_line_ids_without_package[0].qty_done, 2)
        self.assertEqual(receipt.move_line_ids_without_package[1].demand_qty, 3)
        self.assertEqual(receipt.move_line_ids_without_package[1].product_uom_qty, 0)
        self.assertEqual(receipt.move_line_ids_without_package[1].lot_name, False)
        self.assertEqual(receipt.move_line_ids_without_package[1].qty_done, 0)

        receipt = Form(receipt, view='stock.view_picking_form')
        with receipt.move_line_ids_without_package.edit(1) as move_line:
            move_line.lot_name = 'lot2'
            move_line.qty_done = 3
        receipt = receipt.save()
        self.assertEqual(len(receipt.move_line_ids_without_package), 2)
        self.assertEqual(receipt.move_line_ids_without_package[0].demand_qty, 2)
        self.assertEqual(receipt.move_line_ids_without_package[0].product_uom_qty, 5)
        self.assertEqual(receipt.move_line_ids_without_package[0].lot_name, 'lot1')
        self.assertEqual(receipt.move_line_ids_without_package[0].qty_done, 2)
        self.assertEqual(receipt.move_line_ids_without_package[1].demand_qty, 3)
        self.assertEqual(receipt.move_line_ids_without_package[1].product_uom_qty, 0)
        self.assertEqual(receipt.move_line_ids_without_package[1].lot_name, 'lot2')
        self.assertEqual(receipt.move_line_ids_without_package[1].qty_done, 3)

