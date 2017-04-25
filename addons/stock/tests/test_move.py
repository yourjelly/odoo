# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests.common import TransactionCase


class StockMove(TransactionCase):
    def setUp(self):
        super(StockMove, self).setUp()
        self.stock_location = self.env.ref('stock.stock_location_stock')
        self.customer_location = self.env.ref('stock.stock_location_customers')
        self.supplier_location = self.env.ref('stock.stock_location_suppliers')
        self.pack_location = self.env.ref('stock.location_pack_zone')
        self.uom_unit = self.env.ref('product.product_uom_unit')
        self.product1 = self.env['product.product'].create({
            'name': 'Product A',
            'type': 'product',
            'categ_id': self.env.ref('product.product_category_all').id,
        })

    def test_in_1(self):
        """ Receive products from a supplier. Check that a move line is created and that the
        reception correctly increase a single quant in stock.
        """
        # creation
        move1 = self.env['stock.move'].create({
            'name': 'test_in_1',
            'location_id': self.supplier_location.id,
            'location_dest_id': self.stock_location.id,
            'product_id': self.product1.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': 100.0,
        })
        self.assertEqual(move1.state, 'draft')

        # confirmation
        move1.action_confirm()
        self.assertEqual(move1.state, 'confirmed')

        # assignment
        move1.action_assign()
        self.assertEqual(move1.state, 'assigned')
        self.assertEqual(len(move1.pack_operation_ids), 1)

        # fill the move line
        move_line = move1.pack_operation_ids[0]
        self.assertEqual(move_line.product_qty, 100.0)
        self.assertEqual(move_line.qty_done, 0.0)
        move_line.qty_done = 100.0

        # validation
        move1.action_done()
        self.assertEqual(move1.state, 'done')
        # no quants are created in the supplier location
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.supplier_location), 0.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 100.0)
        self.assertEqual(len(self.env['stock.quant']._gather(self.product1, self.supplier_location)), 0.0)
        self.assertEqual(len(self.env['stock.quant']._gather(self.product1, self.stock_location)), 1.0)

    def test_out_1(self):
        """ Send products to a client. Check that a move line is created reserving products in
        stock and that the delivery correctly remove the single quant in stock.
        """
        # make some stock
        self.env['stock.quant'].increase_available_quantity(self.product1, self.stock_location, 100)
        self.assertEqual(len(self.env['stock.quant']._gather(self.product1, self.stock_location)), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 100.0)

        # creation
        move1 = self.env['stock.move'].create({
            'name': 'test_out_1',
            'location_id': self.stock_location.id,
            'location_dest_id': self.customer_location.id,
            'product_id': self.product1.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': 100.0,
        })
        self.assertEqual(move1.state, 'draft')

        # confirmation
        move1.action_confirm()
        self.assertEqual(move1.state, 'confirmed')

        # assignment
        move1.action_assign()
        self.assertEqual(move1.state, 'assigned')
        self.assertEqual(len(move1.pack_operation_ids), 1)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 0.0)
        # Should be a reserved quantity and thus a quant.
        self.assertEqual(len(self.env['stock.quant']._gather(self.product1, self.stock_location)), 1.0)

        # fill the move line
        move_line = move1.pack_operation_ids[0]
        self.assertEqual(move_line.product_qty, 100.0)
        self.assertEqual(move_line.qty_done, 0.0)
        move_line.qty_done = 100.0

        # validation
        move1.action_done()
        self.assertEqual(move1.state, 'done')
        # # no quants are created in the customer location
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.customer_location), 0.0)
        self.assertEqual(len(self.env['stock.quant']._gather(self.product1, self.customer_location)), 0.0)
        # there should be no quant amymore in the stock location
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 0.0)
        self.assertEqual(len(self.env['stock.quant']._gather(self.product1, self.stock_location)), 0.0)

    def test_putaway_1(self):
        """ Receive products from a supplier. Check that putaway rules are rightly applied on
        the receipt move line.
        """
        # This test will apply a putaway strategy on the stock location to put everything
        # incoming in the sublocation shelf1.
        shelf1_location = self.env['stock.location'].create({
            'name': 'shelf1',
            'usage': 'internal',
            'location_id': self.stock_location.id,
        })
        putaway = self.env['product.putaway'].create({
            'name': 'putaway stock->shelf1',
            'fixed_location_ids': [(0, 0, {
                'category_id': self.env.ref('product.product_category_all').id,
                'fixed_location_id': shelf1_location.id,
            })]
        })
        self.stock_location.write({
            'putaway_strategy_id': putaway.id,
        })

        # creation
        move1 = self.env['stock.move'].create({
            'name': 'test_putaway_1',
            'location_id': self.supplier_location.id,
            'location_dest_id': self.stock_location.id,
            'product_id': self.product1.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': 100.0,
        })
        move1.action_confirm()
        self.assertEqual(move1.state, 'confirmed')

        # assignment
        move1.action_assign()
        self.assertEqual(move1.state, 'assigned')
        self.assertEqual(len(move1.pack_operation_ids), 1)

        # check if the putaway was rightly applied
        self.assertEqual(move1.pack_operation_ids.location_dest_id.id, shelf1_location.id)

    def test_availability_1(self):
        """ Check that the `availability` field on a move is correctly computed when there is
        more than enough products in stock.
        """
        # make some stock
        self.env['stock.quant'].increase_available_quantity(self.product1, self.stock_location, 150.0)
        self.assertEqual(len(self.env['stock.quant']._gather(self.product1, self.stock_location)), 1.0)

        move1 = self.env['stock.move'].create({
            'name': 'test_putaway_1',
            'location_id': self.stock_location.id,
            'location_dest_id': self.supplier_location.id,
            'product_id': self.product1.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': 100.0,
        })

        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 150.0)
        self.assertEqual(len(self.env['stock.quant']._gather(self.product1, self.stock_location)), 1.0)
        self.assertEqual(move1.availability, 100.0)

    def test_availability_2(self):
        """ Check that the `availability` field on a move is correctly computed when there is
        not enough products in stock.
        """
        # make some stock
        self.env['stock.quant'].increase_available_quantity(self.product1, self.stock_location, 50.0)
        self.assertEqual(len(self.env['stock.quant']._gather(self.product1, self.stock_location)), 1.0)

        move1 = self.env['stock.move'].create({
            'name': 'test_putaway_1',
            'location_id': self.stock_location.id,
            'location_dest_id': self.supplier_location.id,
            'product_id': self.product1.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': 100.0,
        })

        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 50.0)
        self.assertEqual(len(self.env['stock.quant']._gather(self.product1, self.stock_location)), 1.0)
        self.assertEqual(move1.availability, 50.0)

    def test_unreserve_1(self):
        """ Check that unreserving a stock move sets the products reserved as available and
        set the state back to confirmed.
        """
        # make some stock
        self.env['stock.quant'].increase_available_quantity(self.product1, self.stock_location, 150.0)

        # creation
        move1 = self.env['stock.move'].create({
            'name': 'test_putaway_1',
            'location_id': self.stock_location.id,
            'location_dest_id': self.supplier_location.id,
            'product_id': self.product1.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': 100.0,
        })

        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 150.0)
        self.assertEqual(move1.availability, 100.0)

        # confirmation
        move1.action_confirm()
        self.assertEqual(move1.state, 'confirmed')

        # assignment
        move1.action_assign()
        self.assertEqual(move1.state, 'assigned')
        self.assertEqual(len(move1.pack_operation_ids), 1)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 50.0)

        # unreserve
        move1.do_unreserve()
        self.assertEqual(len(move1.pack_operation_ids), 0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 150.0)
        self.assertEqual(move1.state, 'confirmed')

    def test_unreserve_2(self):
        """ Check that unreserving a stock move sets the products reserved as available and
        set the state back to confirmed even if they are in a pack.
        """
        package1 = self.env['stock.quant.package'].create({'name': 'test_unreserve_2_pack'})

        # make some stock
        self.env['stock.quant'].increase_available_quantity(self.product1, self.stock_location, 150.0, package_id=package1)

        # creation
        move1 = self.env['stock.move'].create({
            'name': 'test_putaway_1',
            'location_id': self.stock_location.id,
            'location_dest_id': self.supplier_location.id,
            'product_id': self.product1.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': 100.0,
        })

        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, package_id=package1), 150.0)
        self.assertEqual(move1.availability, 100.0)

        # confirmation
        move1.action_confirm()
        self.assertEqual(move1.state, 'confirmed')

        # assignment
        move1.action_assign()
        self.assertEqual(move1.state, 'assigned')
        self.assertEqual(len(move1.pack_operation_ids), 1)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, package_id=package1), 50.0)

        # unreserve
        move1.do_unreserve()
        self.assertEqual(len(move1.pack_operation_ids), 0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, package_id=package1), 150.0)
        self.assertEqual(move1.state, 'confirmed')

    def test_unreserve_3(self):
        """ Similar to `test_unreserve_1` but checking the quants more in details.
        """
        # make some stock
        self.env['stock.quant'].increase_available_quantity(self.product1, self.stock_location, 2)
        self.assertEqual(len(self.env['stock.quant']._gather(self.product1, self.stock_location)), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 2)

        # creation
        move1 = self.env['stock.move'].create({
            'name': 'test_out_1',
            'location_id': self.stock_location.id,
            'location_dest_id': self.customer_location.id,
            'product_id': self.product1.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': 2.0,
        })
        self.assertEqual(move1.state, 'draft')

        # confirmation
        move1.action_confirm()
        self.assertEqual(move1.state, 'confirmed')

        # assignment
        move1.action_assign()
        self.assertEqual(move1.state, 'assigned')
        self.assertEqual(len(move1.pack_operation_ids), 1)

        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 0.0)
        quants = self.env['stock.quant']._gather(self.product1, self.stock_location)
        self.assertEqual(len(quants), 1.0)
        self.assertEqual(quants.quantity, 2.0)
        self.assertEqual(quants.reserved_quantity, 2.0)

        move1.do_unreserve()
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 2.0)
        self.assertEqual(len(quants), 1.0)
        self.assertEqual(quants.quantity, 2.0)
        self.assertEqual(quants.reserved_quantity, 0.0)
        self.assertEqual(len(move1.pack_operation_ids), 0.0)

    def test_unreserve_4(self):
        """ Check the unreservation of a partially available stock move.
        """
        # make some stock
        self.env['stock.quant'].increase_available_quantity(self.product1, self.stock_location, 2)
        self.assertEqual(len(self.env['stock.quant']._gather(self.product1, self.stock_location)), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 2)

        # creation
        move1 = self.env['stock.move'].create({
            'name': 'test_out_1',
            'location_id': self.stock_location.id,
            'location_dest_id': self.customer_location.id,
            'product_id': self.product1.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': 3.0,
        })
        self.assertEqual(move1.state, 'draft')

        # confirmation
        move1.action_confirm()
        self.assertEqual(move1.state, 'confirmed')

        # assignment
        move1.action_assign()
        self.assertEqual(move1.state, 'partially_available')
        self.assertEqual(len(move1.pack_operation_ids), 1)

        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 0.0)
        quants = self.env['stock.quant']._gather(self.product1, self.stock_location)
        self.assertEqual(len(quants), 1.0)
        self.assertEqual(quants.quantity, 2.0)
        self.assertEqual(quants.reserved_quantity, 2.0)

        move1.do_unreserve()
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 2.0)
        self.assertEqual(len(quants), 1.0)
        self.assertEqual(quants.quantity, 2.0)
        self.assertEqual(quants.reserved_quantity, 0.0)
        self.assertEqual(len(move1.pack_operation_ids), 0.0)

    def test_link_assign_1(self):
        """ Test the assignment mechanism when two chained stock moves try to move one unit of an
        untracked product.
        """
        # make some stock
        self.env['stock.quant'].increase_available_quantity(self.product1, self.stock_location, 1.0)
        self.assertEqual(len(self.env['stock.quant']._gather(self.product1, self.stock_location)), 1.0)

        move_stock_pack = self.env['stock.move'].create({
            'name': 'test_link_assign_1_1',
            'location_id': self.stock_location.id,
            'location_dest_id': self.pack_location.id,
            'product_id': self.product1.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': 1.0,
        })
        move_pack_cust = self.env['stock.move'].create({
            'name': 'test_link_assign_1_2',
            'location_id': self.pack_location.id,
            'location_dest_id': self.customer_location.id,
            'product_id': self.product1.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': 1.0,
        })
        move_stock_pack.write({'move_dest_ids': [(4, move_pack_cust.id, 0)]})
        move_pack_cust.write({'move_orig_ids': [(4, move_stock_pack.id, 0)]})

        (move_stock_pack + move_pack_cust).action_confirm()
        move_stock_pack.action_assign()
        move_stock_pack.pack_operation_ids[0].qty_done = 1.0
        move_stock_pack.action_done()
        self.assertEqual(len(move_pack_cust.pack_operation_ids), 1)
        move_line = move_pack_cust.pack_operation_ids[0]
        self.assertEqual(move_line.location_id.id, self.pack_location.id)
        self.assertEqual(move_line.location_dest_id.id, self.customer_location.id)
        self.assertEqual(move_pack_cust.state, 'assigned')

    def test_link_assign_2(self):
        """ Test the assignment mechanism when two chained stock moves try to move one unit of a
        tracked product.
        """
        lot1 = self.env['stock.production.lot'].create({
            'name': 'lot1',
            'product_id': self.product1.id,
        })

        # make some stock
        self.env['stock.quant'].increase_available_quantity(self.product1, self.stock_location, 1.0, lot_id=lot1)
        self.assertEqual(len(self.env['stock.quant']._gather(self.product1, self.stock_location, lot1)), 1.0)

        move_stock_pack = self.env['stock.move'].create({
            'name': 'test_link_2_1',
            'location_id': self.stock_location.id,
            'location_dest_id': self.pack_location.id,
            'product_id': self.product1.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': 1.0,
        })
        move_pack_cust = self.env['stock.move'].create({
            'name': 'test_link_2_2',
            'location_id': self.pack_location.id,
            'location_dest_id': self.customer_location.id,
            'product_id': self.product1.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': 1.0,
        })
        move_stock_pack.write({'move_dest_ids': [(4, move_pack_cust.id, 0)]})
        move_pack_cust.write({'move_orig_ids': [(4, move_stock_pack.id, 0)]})

        (move_stock_pack + move_pack_cust).action_confirm()
        move_stock_pack.action_assign()

        move_line_stock_pack = move_stock_pack.pack_operation_ids[0]
        self.assertEqual(move_line_stock_pack.lot_id.id, lot1.id)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, lot_id=lot1), 0.0)
        self.assertEqual(len(self.env['stock.quant']._gather(self.product1, self.stock_location, lot1)), 1.0)
        self.assertEqual(len(self.env['stock.quant']._gather(self.product1, self.pack_location, lot1)), 0.0)

        move_line_stock_pack.qty_done = 1.0
        move_stock_pack.action_done()
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, lot_id=lot1), 0.0)
        self.assertEqual(len(self.env['stock.quant']._gather(self.product1, self.stock_location, lot1)), 0.0)

        move_line_pack_cust = move_pack_cust.pack_operation_ids[0]
        self.assertEqual(move_line_pack_cust.lot_id.id, lot1.id)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.pack_location, lot_id=lot1), 0.0)
        self.assertEqual(len(self.env['stock.quant']._gather(self.product1, self.pack_location, lot1)), 1.0)

    def test_link_assign_3(self):
        """ Test the assignment mechanism when three chained stock moves (2 sources, 1 dest) try to
        move multiple units of an untracked product.
        """
        # make some stock
        self.env['stock.quant'].increase_available_quantity(self.product1, self.stock_location, 2.0)
        self.assertEqual(len(self.env['stock.quant']._gather(self.product1, self.stock_location)), 1.0)

        move_stock_pack_1 = self.env['stock.move'].create({
            'name': 'test_link_assign_1_1',
            'location_id': self.stock_location.id,
            'location_dest_id': self.pack_location.id,
            'product_id': self.product1.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': 1.0,
        })
        move_stock_pack_2 = self.env['stock.move'].create({
            'name': 'test_link_assign_1_1',
            'location_id': self.stock_location.id,
            'location_dest_id': self.pack_location.id,
            'product_id': self.product1.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': 1.0,
        })
        move_pack_cust = self.env['stock.move'].create({
            'name': 'test_link_assign_1_2',
            'location_id': self.pack_location.id,
            'location_dest_id': self.customer_location.id,
            'product_id': self.product1.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': 2.0,
        })
        move_stock_pack_1.write({'move_dest_ids': [(4, move_pack_cust.id, 0)]})
        move_stock_pack_2.write({'move_dest_ids': [(4, move_pack_cust.id, 0)]})
        move_pack_cust.write({'move_orig_ids': [(4, [move_stock_pack_1.id, move_stock_pack_2.id], 0)]})

        (move_stock_pack_1 + move_stock_pack_2 + move_pack_cust).action_confirm()

        # assign and fulfill the first move
        move_stock_pack_1.action_assign()
        self.assertEqual(move_stock_pack_1.state, 'assigned')
        self.assertEqual(len(move_stock_pack_1.pack_operation_ids), 1)
        move_stock_pack_1.pack_operation_ids[0].qty_done = 1.0
        move_stock_pack_1.action_done()
        self.assertEqual(move_stock_pack_1.state, 'done')

        # the destination move should be partially available and have one move line
        self.assertEqual(move_pack_cust.state, 'partially_available')
        self.assertEqual(len(move_pack_cust.pack_operation_ids), 1)
        # Should have 1 quant in stock_location and another in pack_location
        self.assertEqual(len(self.env['stock.quant']._gather(self.product1, self.stock_location)), 1.0)
        self.assertEqual(len(self.env['stock.quant']._gather(self.product1, self.pack_location)), 1.0)

        move_stock_pack_2.action_assign()
        self.assertEqual(move_stock_pack_2.state, 'assigned')
        self.assertEqual(len(move_stock_pack_2.pack_operation_ids), 1)
        move_stock_pack_2.pack_operation_ids[0].qty_done = 1.0
        move_stock_pack_2.action_done()
        self.assertEqual(move_stock_pack_2.state, 'done')

        self.assertEqual(len(self.env['stock.quant']._gather(self.product1, self.stock_location)), 0.0)
        self.assertEqual(len(self.env['stock.quant']._gather(self.product1, self.pack_location)), 1.0)

        self.assertEqual(move_pack_cust.state, 'assigned')
        self.assertEqual(len(move_pack_cust.pack_operation_ids), 1)
        move_line_1 = move_pack_cust.pack_operation_ids[0]
        self.assertEqual(move_line_1.location_id.id, self.pack_location.id)
        self.assertEqual(move_line_1.location_dest_id.id, self.customer_location.id)
        self.assertEqual(move_line_1.product_qty, 2.0)
        self.assertEqual(move_pack_cust.state, 'assigned')

    def test_link_assign_4(self):
        """ Test the assignment mechanism when three chained stock moves (2 sources, 1 dest) try to
        move multiple units of a tracked by lot product.
        """
        lot1 = self.env['stock.production.lot'].create({
            'name': 'lot1',
            'product_id': self.product1.id,
        })

        # make some stock
        self.env['stock.quant'].increase_available_quantity(self.product1, self.stock_location, 2.0, lot_id=lot1)
        self.assertEqual(len(self.env['stock.quant']._gather(self.product1, self.stock_location, lot1)), 1.0)

        move_stock_pack_1 = self.env['stock.move'].create({
            'name': 'test_link_assign_1_1',
            'location_id': self.stock_location.id,
            'location_dest_id': self.pack_location.id,
            'product_id': self.product1.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': 1.0,
        })
        move_stock_pack_2 = self.env['stock.move'].create({
            'name': 'test_link_assign_1_1',
            'location_id': self.stock_location.id,
            'location_dest_id': self.pack_location.id,
            'product_id': self.product1.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': 1.0,
        })
        move_pack_cust = self.env['stock.move'].create({
            'name': 'test_link_assign_1_2',
            'location_id': self.pack_location.id,
            'location_dest_id': self.customer_location.id,
            'product_id': self.product1.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': 2.0,
        })
        move_stock_pack_1.write({'move_dest_ids': [(4, move_pack_cust.id, 0)]})
        move_stock_pack_2.write({'move_dest_ids': [(4, move_pack_cust.id, 0)]})
        move_pack_cust.write({'move_orig_ids': [(4, [move_stock_pack_1.id, move_stock_pack_2.id], 0)]})

        (move_stock_pack_1 + move_stock_pack_2 + move_pack_cust).action_confirm()

        # assign and fulfill the first move
        move_stock_pack_1.action_assign()
        self.assertEqual(len(move_stock_pack_1.pack_operation_ids), 1)
        self.assertEqual(move_stock_pack_1.pack_operation_ids[0].lot_id.id, lot1.id)
        move_stock_pack_1.pack_operation_ids[0].qty_done = 1.0
        move_stock_pack_1.action_done()

        # the destination move should be partially available and have one move line
        self.assertEqual(len(move_pack_cust.pack_operation_ids), 1)

        move_stock_pack_2.action_assign()
        self.assertEqual(len(move_stock_pack_2.pack_operation_ids), 1)
        self.assertEqual(move_stock_pack_2.pack_operation_ids[0].lot_id.id, lot1.id)
        move_stock_pack_2.pack_operation_ids[0].qty_done = 1.0
        move_stock_pack_2.action_done()

        self.assertEqual(len(move_pack_cust.pack_operation_ids), 1)
        move_line_1 = move_pack_cust.pack_operation_ids[0]
        self.assertEqual(move_line_1.location_id.id, self.pack_location.id)
        self.assertEqual(move_line_1.location_dest_id.id, self.customer_location.id)
        self.assertEqual(move_line_1.product_qty, 2.0)
        self.assertEqual(move_line_1.lot_id.id, lot1.id)
        self.assertEqual(move_pack_cust.state, 'assigned')

    def test_link_assign_5(self):
        """ Test the assignment mechanism when three chained stock moves (1 sources, 2 dest) try to
        move multiple units of an untracked product.
        """
        # make some stock
        self.env['stock.quant'].increase_available_quantity(self.product1, self.stock_location, 2.0)

        move_stock_pack = self.env['stock.move'].create({
            'name': 'test_link_assign_1_1',
            'location_id': self.stock_location.id,
            'location_dest_id': self.pack_location.id,
            'product_id': self.product1.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': 2.0,
        })
        move_pack_cust_1 = self.env['stock.move'].create({
            'name': 'test_link_assign_1_1',
            'location_id': self.pack_location.id,
            'location_dest_id': self.customer_location.id,
            'product_id': self.product1.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': 1.0,
        })
        move_pack_cust_2 = self.env['stock.move'].create({
            'name': 'test_link_assign_1_2',
            'location_id': self.pack_location.id,
            'location_dest_id': self.customer_location.id,
            'product_id': self.product1.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': 1.0,
        })
        move_stock_pack.write({'move_dest_ids': [(4, move_pack_cust_1.id, move_pack_cust_2.id, 0)]})
        move_pack_cust_1.write({'move_orig_ids': [(4, move_stock_pack.id, 0)]})
        move_pack_cust_2.write({'move_orig_ids': [(4, move_stock_pack.id, 0)]})

        (move_stock_pack + move_pack_cust_1 + move_pack_cust_2).action_confirm()

        # assign and fulfill the first move
        move_stock_pack.action_assign()
        self.assertEqual(len(move_stock_pack.pack_operation_ids), 1)
        move_stock_pack.pack_operation_ids[0].qty_done = 2.0
        move_stock_pack.action_done()

        # the destination moves should be available and have one move line
        self.assertEqual(len(move_pack_cust_1.pack_operation_ids), 1)
        self.assertEqual(len(move_pack_cust_2.pack_operation_ids), 1)

        move_pack_cust_1.pack_operation_ids[0].qty_done = 1.0
        move_pack_cust_2.pack_operation_ids[0].qty_done = 1.0
        (move_pack_cust_1 + move_pack_cust_2).action_done()

    def test_link_assign_6(self):
        """ Test the assignment mechanism when four chained stock moves (2 sources, 2 dest) try to
        move multiple units of an untracked by lot product. This particular test case simulates a two
        step receipts with backorder.
        """
        move_supp_stock_1 = self.env['stock.move'].create({
            'name': 'test_link_assign_6_1',
            'location_id': self.supplier_location.id,
            'location_dest_id': self.stock_location.id,
            'product_id': self.product1.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': 3.0,
        })
        move_supp_stock_2 = self.env['stock.move'].create({
            'name': 'test_link_assign_6_1',
            'location_id': self.supplier_location.id,
            'location_dest_id': self.stock_location.id,
            'product_id': self.product1.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': 2.0,
        })
        move_stock_stock_1 = self.env['stock.move'].create({
            'name': 'test_link_assign_6_1',
            'location_id': self.stock_location.id,
            'location_dest_id': self.stock_location.id,
            'product_id': self.product1.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': 3.0,
        })
        move_stock_stock_1.write({'move_orig_ids': [(4, [move_supp_stock_1.id, move_supp_stock_2.id], 0)]})
        move_stock_stock_2 = self.env['stock.move'].create({
            'name': 'test_link_assign_6_1',
            'location_id': self.stock_location.id,
            'location_dest_id': self.stock_location.id,
            'product_id': self.product1.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': 3.0,
        })
        move_stock_stock_2.write({'move_orig_ids': [(4, [move_supp_stock_1.id, move_supp_stock_2.id], 0)]})

        (move_supp_stock_1 + move_supp_stock_2 + move_stock_stock_1 + move_stock_stock_2).action_confirm()
        move_supp_stock_1.action_assign()
        self.assertEqual(move_supp_stock_1.state, 'assigned')
        self.assertEqual(move_supp_stock_2.state, 'confirmed')
        self.assertEqual(move_stock_stock_1.state, 'waiting')
        self.assertEqual(move_stock_stock_2.state, 'waiting')
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 0.0)

        # do the fist move, it'll bring 3 units in stock location so only `move_stock_stock_1`
        # should be assigned
        move_supp_stock_1.pack_operation_ids.qty_done = 3.0
        move_supp_stock_1.action_done()
        self.assertEqual(move_supp_stock_1.state, 'done')
        self.assertEqual(move_supp_stock_2.state, 'confirmed')
        self.assertEqual(move_stock_stock_1.state, 'assigned')
        self.assertEqual(move_stock_stock_2.state, 'waiting')

    def test_use_unreserved_move_line_1(self):
        """ Test that validating a stock move linked to an untracked product reserved by another one
        correctly unreserves the other one.
        """
        # make some stock
        self.env['stock.quant'].increase_available_quantity(self.product1, self.stock_location, 1.0)

        # prepare the conflicting move
        move1 = self.env['stock.move'].create({
            'name': 'test_use_unreserved_move_line_1_1',
            'location_id': self.stock_location.id,
            'location_dest_id': self.customer_location.id,
            'product_id': self.product1.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': 1.0,
        })
        move2 = self.env['stock.move'].create({
            'name': 'test_use_unreserved_move_line_1_1',
            'location_id': self.stock_location.id,
            'location_dest_id': self.customer_location.id,
            'product_id': self.product1.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': 1.0,
        })

        # reserve those move
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 1.0)
        move1.action_confirm()
        move1.action_assign()
        self.assertEqual(move1.state, 'assigned')
        move2.action_confirm()
        move2.action_assign()
        self.assertEqual(move2.state, 'confirmed')

        # force assign the second one
        move2.force_assign()
        self.assertEqual(move2.state, 'assigned')

        # use the product from the first one
        move2.write({'pack_operation_ids': [(0, 0, {
            'product_id': self.product1.id,
            'product_uom_id': self.uom_unit.id,
            'qty_done': 1,
            'product_qty': 0,
            'lot_id': False,
            'package_id': False,
            'result_package_id': False,
            'location_id': move2.location_id.id,
            'location_dest_id': move2.location_dest_id.id,
        })]})
        move2.action_done()

        # the first move should go back to confirmed
        self.assertEqual(move1.state, 'confirmed')
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 0.0)

    def test_use_unreserved_move_line_2(self):
        """ Test that validating a stock move linked to a tracked product reserved by another one
        correctly unreserves the other one.
        """
        lot1 = self.env['stock.production.lot'].create({
            'name': 'lot1',
            'product_id': self.product1.id,
        })

        # make some stock
        self.env['stock.quant'].increase_available_quantity(self.product1, self.stock_location, 1.0, lot_id=lot1)

        # prepare the conflicting move
        move1 = self.env['stock.move'].create({
            'name': 'test_use_unreserved_move_line_1_1',
            'location_id': self.stock_location.id,
            'location_dest_id': self.customer_location.id,
            'product_id': self.product1.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': 1.0,
        })
        move2 = self.env['stock.move'].create({
            'name': 'test_use_unreserved_move_line_1_1',
            'location_id': self.stock_location.id,
            'location_dest_id': self.customer_location.id,
            'product_id': self.product1.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': 1.0,
        })

        # reserve those move
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, lot_id=lot1), 1.0)
        move1.action_confirm()
        move1.action_assign()
        self.assertEqual(move1.state, 'assigned')
        move2.action_confirm()
        move2.action_assign()
        self.assertEqual(move2.state, 'confirmed')

        # force assign the second one
        move2.force_assign()
        self.assertEqual(move2.state, 'assigned')

        # use the product from the first one
        move2.write({'pack_operation_ids': [(0, 0, {
            'product_id': self.product1.id,
            'product_uom_id': self.uom_unit.id,
            'qty_done': 1,
            'product_qty': 0,
            'lot_id': lot1.id,
            'package_id': False,
            'result_package_id': False,
            'location_id': move2.location_id.id,
            'location_dest_id': move2.location_dest_id.id,
        })]})
        move2.action_done()

        # the first move should go back to confirmed
        self.assertEqual(move1.state, 'confirmed')
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, lot_id=lot1), 0.0)

    def test_edit_reserved_move_line_1(self):
        """ Test that editing a stock move line linked to an untracked product correctly and
        directly adapts the reservation. In this case, we edit the sublocation where we take the
        product to another sublocation where a product is available.
        """
        shelf1_location = self.env['stock.location'].create({
            'name': 'shelf1',
            'usage': 'internal',
            'location_id': self.stock_location.id,
        })
        shelf2_location = self.env['stock.location'].create({
            'name': 'shelf1',
            'usage': 'internal',
            'location_id': self.stock_location.id,
        })
        self.env['stock.quant'].increase_available_quantity(self.product1, shelf1_location, 1.0)
        self.env['stock.quant'].increase_available_quantity(self.product1, shelf2_location, 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, shelf1_location), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, shelf2_location), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 2.0)

        move1 = self.env['stock.move'].create({
            'name': 'test_edit_moveline_1',
            'location_id': self.stock_location.id,
            'location_dest_id': self.customer_location.id,
            'product_id': self.product1.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': 1.0,
        })
        move1.action_confirm()
        move1.action_assign()

        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, shelf1_location), 0.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, shelf2_location), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 1.0)

        move1.pack_operation_ids.location_id = shelf2_location.id

        self.assertEqual(move1.reserved_availability, 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, shelf1_location), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, shelf2_location), 0.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 1.0)

    def test_edit_reserved_move_line_2(self):
        """ Test that editing a stock move line linked to a tracked product correctly and directly
        adapts the reservation. In this case, we edit the lot to another available one.
        """
        lot1 = self.env['stock.production.lot'].create({
            'name': 'lot1',
            'product_id': self.product1.id,
        })
        lot2 = self.env['stock.production.lot'].create({
            'name': 'lot2',
            'product_id': self.product1.id,
        })
        self.env['stock.quant'].increase_available_quantity(self.product1, self.stock_location, 1.0, lot_id=lot1)
        self.env['stock.quant'].increase_available_quantity(self.product1, self.stock_location, 1.0, lot_id=lot2)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 2.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, lot_id=lot1), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, lot_id=lot2), 1.0)

        move1 = self.env['stock.move'].create({
            'name': 'test_edit_moveline_1',
            'location_id': self.stock_location.id,
            'location_dest_id': self.customer_location.id,
            'product_id': self.product1.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': 1.0,
        })
        move1.action_confirm()
        move1.action_assign()

        self.assertEqual(move1.reserved_availability, 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, lot_id=lot1), 0.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, lot_id=lot2), 1.0)

        move1.pack_operation_ids.lot_id = lot2.id

        self.assertEqual(move1.reserved_availability, 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, lot_id=lot1), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, lot_id=lot2), 0.0)

    def test_edit_reserved_move_line_3(self):
        """ Test that editing a stock move line linked to a packed product correctly and directly
        adapts the reservation. In this case, we edit the package to another available one.
        """
        package1 = self.env['stock.quant.package'].create({'name': 'test_edit_reserved_move_line_3'})
        package2 = self.env['stock.quant.package'].create({'name': 'test_edit_reserved_move_line_3'})

        self.env['stock.quant'].increase_available_quantity(self.product1, self.stock_location, 1.0, package_id=package1)
        self.env['stock.quant'].increase_available_quantity(self.product1, self.stock_location, 1.0, package_id=package2)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 2.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, package_id=package1), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, package_id=package2), 1.0)

        move1 = self.env['stock.move'].create({
            'name': 'test_edit_moveline_1',
            'location_id': self.stock_location.id,
            'location_dest_id': self.customer_location.id,
            'product_id': self.product1.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': 1.0,
        })
        move1.action_confirm()
        move1.action_assign()

        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, package_id=package1), 0.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, package_id=package2), 1.0)

        move1.pack_operation_ids.package_id = package2.id

        self.assertEqual(move1.reserved_availability, 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, package_id=package1), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, package_id=package2), 0.0)

    def test_edit_reserved_move_line_4(self):
        """ Test that editing a stock move line linked to an owned product correctly and directly
        adapts the reservation. In this case, we edit the owner to another available one.
        """
        owner1 = self.env['res.partner'].create({'name': 'test_edit_reserved_move_line_4_1'})
        owner2 = self.env['res.partner'].create({'name': 'test_edit_reserved_move_line_4_2'})

        self.env['stock.quant'].increase_available_quantity(self.product1, self.stock_location, 1.0, owner_id=owner1)
        self.env['stock.quant'].increase_available_quantity(self.product1, self.stock_location, 1.0, owner_id=owner2)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 2.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, owner_id=owner1), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, owner_id=owner2), 1.0)

        move1 = self.env['stock.move'].create({
            'name': 'test_edit_moveline_1',
            'location_id': self.stock_location.id,
            'location_dest_id': self.customer_location.id,
            'product_id': self.product1.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': 1.0,
        })
        move1.action_confirm()
        move1.action_assign()

        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, owner_id=owner1), 0.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, owner_id=owner2), 1.0)

        move1.pack_operation_ids.owner_id = owner2.id

        self.assertEqual(move1.reserved_availability, 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, owner_id=owner1), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, owner_id=owner2), 0.0)

    def test_edit_reserved_move_line_5(self):
        """ Test that editing a stock move line linked to a packed and tracked product correctly
        and directly adapts the reservation. In this case, we edit the lot to another available one
        that is not in a pack.
        """
        lot1 = self.env['stock.production.lot'].create({
            'name': 'lot1',
            'product_id': self.product1.id,
        })
        lot2 = self.env['stock.production.lot'].create({
            'name': 'lot2',
            'product_id': self.product1.id,
        })
        package1 = self.env['stock.quant.package'].create({'name': 'test_edit_reserved_move_line_5'})

        self.env['stock.quant'].increase_available_quantity(self.product1, self.stock_location, 1.0, lot_id=lot1, package_id=package1)
        self.env['stock.quant'].increase_available_quantity(self.product1, self.stock_location, 1.0, lot_id=lot2)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 2.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, lot_id=lot1, package_id=package1), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, lot_id=lot2), 1.0)

        move1 = self.env['stock.move'].create({
            'name': 'test_edit_moveline_1',
            'location_id': self.stock_location.id,
            'location_dest_id': self.customer_location.id,
            'product_id': self.product1.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': 1.0,
        })
        move1.action_confirm()
        move1.action_assign()

        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, lot_id=lot1, package_id=package1), 0.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, lot_id=lot2), 1.0)
        move_line = move1.pack_operation_ids[0]
        move_line.write({'package_id': False, 'lot_id': lot2.id})

        self.assertEqual(move1.reserved_availability, 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, lot_id=lot1, package_id=package1), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, lot_id=lot2), 0.0)

    def test_edit_reserved_move_line_6(self):
        """ Test that editing a stock move line linked to an untracked product correctly and
        directly adapts the reservation. In this case, we edit the sublocation where we take the
        product to another sublocation where a product is NOT available.
        """
        shelf1_location = self.env['stock.location'].create({
            'name': 'shelf1',
            'usage': 'internal',
            'location_id': self.stock_location.id,
        })
        shelf2_location = self.env['stock.location'].create({
            'name': 'shelf1',
            'usage': 'internal',
            'location_id': self.stock_location.id,
        })
        self.env['stock.quant'].increase_available_quantity(self.product1, shelf1_location, 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, shelf1_location), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, shelf2_location), 0.0)

        move1 = self.env['stock.move'].create({
            'name': 'test_edit_moveline_1',
            'location_id': self.stock_location.id,
            'location_dest_id': self.customer_location.id,
            'product_id': self.product1.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': 1.0,
        })
        move1.action_confirm()
        move1.action_assign()

        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, shelf1_location), 0.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, shelf2_location), 0.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 0.0)

        move1.pack_operation_ids.location_id = shelf2_location.id

        self.assertEqual(move1.reserved_availability, 0.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, shelf1_location), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, shelf2_location), 0.0)

    def test_edit_done_move_line_1(self):
        """ Test that editing a done stock move line linked to an untracked product correctly and
        directly adapts the transfer. In this case, we edit the sublocation where we take the
        product to another sublocation where a product is available.
        """
        shelf1_location = self.env['stock.location'].create({
            'name': 'shelf1',
            'usage': 'internal',
            'location_id': self.stock_location.id,
        })
        shelf2_location = self.env['stock.location'].create({
            'name': 'shelf1',
            'usage': 'internal',
            'location_id': self.stock_location.id,
        })
        self.env['stock.quant'].increase_available_quantity(self.product1, shelf1_location, 1.0)
        self.env['stock.quant'].increase_available_quantity(self.product1, shelf2_location, 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, shelf1_location), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, shelf2_location), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 2.0)

        # move from shelf1
        move1 = self.env['stock.move'].create({
            'name': 'test_edit_moveline_1',
            'location_id': self.stock_location.id,
            'location_dest_id': self.customer_location.id,
            'product_id': self.product1.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': 1.0,
        })
        move1.action_confirm()
        move1.action_assign()
        move1.pack_operation_ids.qty_done = 1
        move1.action_done()

        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, shelf1_location), 0.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, shelf2_location), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 1.0)

        # edit once done, we actually moved from shelf2
        move1.pack_operation_ids.location_id = shelf2_location.id

        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, shelf1_location), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, shelf2_location), 0.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 1.0)

    def test_edit_done_move_line_2(self):
        """ Test that editing a done stock move line linked to a tracked product correctly and directly
        adapts the transfer. In this case, we edit the lot to another available one.
        """
        lot1 = self.env['stock.production.lot'].create({
            'name': 'lot1',
            'product_id': self.product1.id,
        })
        lot2 = self.env['stock.production.lot'].create({
            'name': 'lot2',
            'product_id': self.product1.id,
        })
        self.env['stock.quant'].increase_available_quantity(self.product1, self.stock_location, 1.0, lot_id=lot1)
        self.env['stock.quant'].increase_available_quantity(self.product1, self.stock_location, 1.0, lot_id=lot2)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 2.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, lot_id=lot1), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, lot_id=lot2), 1.0)

        move1 = self.env['stock.move'].create({
            'name': 'test_edit_moveline_1',
            'location_id': self.stock_location.id,
            'location_dest_id': self.customer_location.id,
            'product_id': self.product1.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': 1.0,
        })
        move1.action_confirm()
        move1.action_assign()
        move1.pack_operation_ids.qty_done = 1
        move1.action_done()

        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, lot_id=lot1), 0.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, lot_id=lot2), 1.0)

        move1.pack_operation_ids.lot_id = lot2.id

        self.assertEqual(move1.reserved_availability, 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, lot_id=lot1), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, lot_id=lot2), 0.0)

    def test_edit_done_move_line_3(self):
        """ Test that editing a done stock move line linked to a packed product correctly and directly
        adapts the transfer. In this case, we edit the package to another available one.
        """
        package1 = self.env['stock.quant.package'].create({'name': 'test_edit_reserved_move_line_3'})
        package2 = self.env['stock.quant.package'].create({'name': 'test_edit_reserved_move_line_3'})

        self.env['stock.quant'].increase_available_quantity(self.product1, self.stock_location, 1.0, package_id=package1)
        self.env['stock.quant'].increase_available_quantity(self.product1, self.stock_location, 1.0, package_id=package2)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 2.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, package_id=package1), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, package_id=package2), 1.0)

        move1 = self.env['stock.move'].create({
            'name': 'test_edit_moveline_1',
            'location_id': self.stock_location.id,
            'location_dest_id': self.customer_location.id,
            'product_id': self.product1.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': 1.0,
        })
        move1.action_confirm()
        move1.action_assign()
        move1.pack_operation_ids.qty_done = 1
        move1.action_done()

        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, package_id=package1), 0.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, package_id=package2), 1.0)

        move1.pack_operation_ids.package_id = package2.id

        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, package_id=package1), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, package_id=package2), 0.0)

    def test_edit_done_move_line_4(self):
        """ Test that editing a done stock move line linked to an owned product correctly and directly
        adapts the transfer. In this case, we edit the owner to another available one.
        """
        owner1 = self.env['res.partner'].create({'name': 'test_edit_reserved_move_line_4_1'})
        owner2 = self.env['res.partner'].create({'name': 'test_edit_reserved_move_line_4_2'})

        self.env['stock.quant'].increase_available_quantity(self.product1, self.stock_location, 1.0, owner_id=owner1)
        self.env['stock.quant'].increase_available_quantity(self.product1, self.stock_location, 1.0, owner_id=owner2)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 2.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, owner_id=owner1), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, owner_id=owner2), 1.0)

        move1 = self.env['stock.move'].create({
            'name': 'test_edit_moveline_1',
            'location_id': self.stock_location.id,
            'location_dest_id': self.customer_location.id,
            'product_id': self.product1.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': 1.0,
        })
        move1.action_confirm()
        move1.action_assign()
        move1.pack_operation_ids.qty_done = 1
        move1.action_done()

        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, owner_id=owner1), 0.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, owner_id=owner2), 1.0)

        move1.pack_operation_ids.owner_id = owner2.id

        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, owner_id=owner1), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, owner_id=owner2), 0.0)

    def test_edit_done_move_line_5(self):
        """ Test that editing a done stock move line linked to a packed and tracked product correctly
        and directly adapts the transfer. In this case, we edit the lot to another available one
        that is not in a pack.
        """
        lot1 = self.env['stock.production.lot'].create({
            'name': 'lot1',
            'product_id': self.product1.id,
        })
        lot2 = self.env['stock.production.lot'].create({
            'name': 'lot2',
            'product_id': self.product1.id,
        })
        package1 = self.env['stock.quant.package'].create({'name': 'test_edit_reserved_move_line_5'})

        self.env['stock.quant'].increase_available_quantity(self.product1, self.stock_location, 1.0, lot_id=lot1, package_id=package1)
        self.env['stock.quant'].increase_available_quantity(self.product1, self.stock_location, 1.0, lot_id=lot2)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 2.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, lot_id=lot1, package_id=package1), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, lot_id=lot2), 1.0)

        move1 = self.env['stock.move'].create({
            'name': 'test_edit_moveline_1',
            'location_id': self.stock_location.id,
            'location_dest_id': self.customer_location.id,
            'product_id': self.product1.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': 1.0,
        })
        move1.action_confirm()
        move1.action_assign()
        move1.pack_operation_ids.qty_done = 1
        move1.action_done()

        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, lot_id=lot1, package_id=package1), 0.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, lot_id=lot2), 1.0)
        move_line = move1.pack_operation_ids[0]
        move_line.write({'package_id': False, 'lot_id': lot2.id})

        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, lot_id=lot1, package_id=package1), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location, lot_id=lot2), 0.0)

    def test_edit_done_move_line_6(self):
        """ Test that editing a done stock move line linked to an untracked product correctly and
        directly adapts the transfer. In this case, we edit the sublocation where we take the
        product to another sublocation where a product is NOT available.
        """
        shelf1_location = self.env['stock.location'].create({
            'name': 'shelf1',
            'usage': 'internal',
            'location_id': self.stock_location.id,
        })
        shelf2_location = self.env['stock.location'].create({
            'name': 'shelf1',
            'usage': 'internal',
            'location_id': self.stock_location.id,
        })
        self.env['stock.quant'].increase_available_quantity(self.product1, shelf1_location, 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, shelf1_location), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, shelf2_location), 0.0)

        move1 = self.env['stock.move'].create({
            'name': 'test_edit_moveline_1',
            'location_id': self.stock_location.id,
            'location_dest_id': self.customer_location.id,
            'product_id': self.product1.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': 1.0,
        })
        move1.action_confirm()
        move1.action_assign()
        move1.pack_operation_ids.qty_done = 1
        move1.action_done()

        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, shelf1_location), 0.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, shelf2_location), 0.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 0.0)

        move1.pack_operation_ids.location_id = shelf2_location.id

        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 0.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, shelf1_location), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, shelf2_location), -1.0)

    def test_edit_done_move_line_7(self):
        """ Test that editing a done stock move line linked to an untracked product correctly and
        directly adapts the transfer. In this case, we edit the sublocation where we take the
        product to another sublocation where a product is NOT available because it has been reserved
        by another move.
        """
        shelf1_location = self.env['stock.location'].create({
            'name': 'shelf1',
            'usage': 'internal',
            'location_id': self.stock_location.id,
        })
        shelf2_location = self.env['stock.location'].create({
            'name': 'shelf1',
            'usage': 'internal',
            'location_id': self.stock_location.id,
        })
        self.env['stock.quant'].increase_available_quantity(self.product1, shelf1_location, 1.0)
        self.env['stock.quant'].increase_available_quantity(self.product1, shelf2_location, 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 2.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, shelf1_location), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, shelf2_location), 1.0)

        move1 = self.env['stock.move'].create({
            'name': 'test_edit_moveline_1',
            'location_id': self.stock_location.id,
            'location_dest_id': self.customer_location.id,
            'product_id': self.product1.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': 1.0,
        })
        move1.action_confirm()
        move1.action_assign()
        move1.pack_operation_ids.qty_done = 1
        move1.action_done()

        move2 = self.env['stock.move'].create({
            'name': 'test_edit_moveline_1',
            'location_id': self.stock_location.id,
            'location_dest_id': self.customer_location.id,
            'product_id': self.product1.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': 1.0,
        })
        move2.action_confirm()
        move2.action_assign()

        self.assertEqual(move2.state, 'assigned')
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, shelf1_location), 0.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, shelf2_location), 0.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 0.0)

        move1.pack_operation_ids.location_id = shelf2_location.id

        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, shelf1_location), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, shelf2_location), 0.0)
        self.assertEqual(move2.state, 'confirmed')

    def test_edit_done_move_line_8(self):
        """ Test that editing a done stock move line linked to an untracked product correctly and
        directly adapts the transfer. In this case, we increment the quantity done (and we do not
        have more in stock.
        """
        shelf1_location = self.env['stock.location'].create({
            'name': 'shelf1',
            'usage': 'internal',
            'location_id': self.stock_location.id,
        })
        self.env['stock.quant'].increase_available_quantity(self.product1, shelf1_location, 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, shelf1_location), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 1.0)

        # move from shelf1
        move1 = self.env['stock.move'].create({
            'name': 'test_edit_moveline_1',
            'location_id': self.stock_location.id,
            'location_dest_id': self.customer_location.id,
            'product_id': self.product1.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': 1.0,
        })
        move1.action_confirm()
        move1.action_assign()
        move1.pack_operation_ids.qty_done = 1
        move1.action_done()

        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, shelf1_location), 0.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), 0.0)

        # edit once done, we actually moved 2 products
        move1.pack_operation_ids.qty_done = 2

        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, shelf1_location), -1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.product1, self.stock_location), -1.0)

# todo att test addig moveline when done