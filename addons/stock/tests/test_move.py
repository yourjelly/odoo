# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests.common import TransactionCase


class StockMove(TransactionCase):
    def test_in_1(self):
        """ Receive products from a supplier.
        """
        supplier_location = self.env.ref('stock.stock_location_suppliers')
        stock_location = self.env.ref('stock.stock_location_stock')
        uom_unit = self.env.ref('product.product_uom_unit')
        product1 = self.env['product.product'].create({
            'name': 'Product A',
            'type': 'product',
        })

        # creation
        move1 = self.env['stock.move'].create({
            'name': 'test_in_1',
            'location_id': supplier_location.id,
            'location_dest_id': stock_location.id,
            'product_id': product1.id,
            'product_uom': uom_unit.id,
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
        self.assertEqual(move_line.product_qty, 0.0)
        self.assertEqual(move_line.qty_done, 0.0)
        move_line.qty_done = 100.0

        # validation
        move1.action_done()
        self.assertEqual(move1.state, 'done')
        # no quants are created in the supplier location
        self.assertEqual(self.env['stock.quant'].get_available_quantity(product1, supplier_location), 0.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(product1, stock_location), 100.0)
        self.assertEqual(len(self.env['stock.quant']._gather(product1, supplier_location)), 0.0)
        self.assertEqual(len(self.env['stock.quant']._gather(product1, stock_location)), 1.0)

    def test_out_1(self):
        """ Send products to a client.
        """
        customer_location = self.env.ref('stock.stock_location_customers')
        stock_location = self.env.ref('stock.stock_location_stock')
        uom_unit = self.env.ref('product.product_uom_unit')
        product1 = self.env['product.product'].create({
            'name': 'Product A',
            'type': 'product',
        })

        # make some stock
        self.env['stock.quant'].increase_available_quantity(product1, stock_location, 100)
        self.assertEqual(len(self.env['stock.quant']._gather(product1, stock_location)), 1.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(product1, stock_location), 100.0)

        # creation
        move1 = self.env['stock.move'].create({
            'name': 'test_out_1',
            'location_id': stock_location.id,
            'location_dest_id': customer_location.id,
            'product_id': product1.id,
            'product_uom': uom_unit.id,
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
        self.assertEqual(self.env['stock.quant'].get_available_quantity(product1, stock_location), 0.0)
        # Should be a reserved quantity and thus a quant.
        self.assertEqual(len(self.env['stock.quant']._gather(product1, stock_location)), 1.0)

        # fill the move line
        move_line = move1.pack_operation_ids[0]
        self.assertEqual(move_line.product_qty, 100.0)
        self.assertEqual(move_line.qty_done, 0.0)
        move_line.qty_done = 100.0

        # validation
        move1.action_done()
        self.assertEqual(move1.state, 'done')
        # # no quants are created in the customer location
        self.assertEqual(self.env['stock.quant'].get_available_quantity(product1, customer_location), 0.0)
        self.assertEqual(len(self.env['stock.quant']._gather(product1, customer_location)), 0.0)
        # there should be no quant amymore in the stock location
        self.assertEqual(self.env['stock.quant'].get_available_quantity(product1, stock_location), 0.0)
        self.assertEqual(len(self.env['stock.quant']._gather(product1, stock_location)), 0.0)

    def test_putaway_1(self):
        """ Receive products from a supplier. Check that putaway rules are rightly applied on
        move lines.
        """
        # This test will apply a putaway strategy on the stock location to put everything
        # incoming in the sublocation shelf1.
        supplier_location = self.env.ref('stock.stock_location_suppliers')
        stock_location = self.env.ref('stock.stock_location_stock')
        shelf1_location = self.env['stock.location'].create({
            'name': 'shelf1',
            'usage': 'internal',
            'location_id': stock_location.id,
        })
        uom_unit = self.env.ref('product.product_uom_unit')
        product1 = self.env['product.product'].create({
            'name': 'Product A',
            'type': 'product',
            'categ_id': self.env.ref('product.product_category_all').id,
        })
        putaway = self.env['product.putaway'].create({
            'name': 'putaway stock->shelf1',
            'fixed_location_ids': [(0, 0, {
                'category_id': self.env.ref('product.product_category_all').id,
                'fixed_location_id': shelf1_location.id,
            })]
        })
        stock_location.write({
            'putaway_strategy_id': putaway.id,
        })

        # creation
        move1 = self.env['stock.move'].create({
            'name': 'test_putaway_1',
            'location_id': supplier_location.id,
            'location_dest_id': stock_location.id,
            'product_id': product1.id,
            'product_uom': uom_unit.id,
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
        stock_location = self.env.ref('stock.stock_location_stock')
        supplier_location = self.env.ref('stock.stock_location_suppliers')
        uom_unit = self.env.ref('product.product_uom_unit')
        product1 = self.env['product.product'].create({
            'name': 'Product A',
            'type': 'product',
            'categ_id': self.env.ref('product.product_category_all').id,
        })

        # make some stock
        self.env['stock.quant'].increase_available_quantity(product1, stock_location, 150.0)
        self.assertEqual(len(self.env['stock.quant']._gather(product1, stock_location)), 1.0)

        move1 = self.env['stock.move'].create({
            'name': 'test_putaway_1',
            'location_id': stock_location.id,
            'location_dest_id': supplier_location.id,
            'product_id': product1.id,
            'product_uom': uom_unit.id,
            'product_uom_qty': 100.0,
        })

        self.assertEqual(self.env['stock.quant'].get_available_quantity(product1, stock_location), 150.0)
        self.assertEqual(len(self.env['stock.quant']._gather(product1, stock_location)), 1.0)
        self.assertEqual(move1.availability, 100.0)

    def test_availability_2(self):
        """ Check that the `availability` field on a move is correctly computed when there is
        more not enough products in stock.
        """
        stock_location = self.env.ref('stock.stock_location_stock')
        supplier_location = self.env.ref('stock.stock_location_suppliers')
        uom_unit = self.env.ref('product.product_uom_unit')
        product1 = self.env['product.product'].create({
            'name': 'Product A',
            'type': 'product',
            'categ_id': self.env.ref('product.product_category_all').id,
        })

        # make some stock
        self.env['stock.quant'].increase_available_quantity(product1, stock_location, 50.0)
        self.assertEqual(len(self.env['stock.quant']._gather(product1, stock_location)), 1.0)

        move1 = self.env['stock.move'].create({
            'name': 'test_putaway_1',
            'location_id': stock_location.id,
            'location_dest_id': supplier_location.id,
            'product_id': product1.id,
            'product_uom': uom_unit.id,
            'product_uom_qty': 100.0,
        })

        self.assertEqual(self.env['stock.quant'].get_available_quantity(product1, stock_location), 50.0)
        self.assertEqual(len(self.env['stock.quant']._gather(product1, stock_location)), 1.0)
        self.assertEqual(move1.availability, 50.0)

    def test_unreserve_1(self):
        """ Check that unreserving a stock move sets the products reserved as available and
        set the state back to confirmed.
        """
        stock_location = self.env.ref('stock.stock_location_stock')
        supplier_location = self.env.ref('stock.stock_location_suppliers')
        uom_unit = self.env.ref('product.product_uom_unit')
        product1 = self.env['product.product'].create({
            'name': 'Product A',
            'type': 'product',
            'categ_id': self.env.ref('product.product_category_all').id,
        })

        # make some stock
        self.env['stock.quant'].increase_available_quantity(product1, stock_location, 150.0)

        # creation
        move1 = self.env['stock.move'].create({
            'name': 'test_putaway_1',
            'location_id': stock_location.id,
            'location_dest_id': supplier_location.id,
            'product_id': product1.id,
            'product_uom': uom_unit.id,
            'product_uom_qty': 100.0,
        })

        self.assertEqual(self.env['stock.quant'].get_available_quantity(product1, stock_location), 150.0)
        self.assertEqual(move1.availability, 100.0)

        # confirmation
        move1.action_confirm()
        self.assertEqual(move1.state, 'confirmed')

        # assignment
        move1.action_assign()
        self.assertEqual(move1.state, 'assigned')
        self.assertEqual(len(move1.pack_operation_ids), 1)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(product1, stock_location), 50.0)

        # unreserve
        move1.do_unreserve()
        self.assertEqual(len(move1.pack_operation_ids), 0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(product1, stock_location), 150.0)
        self.assertEqual(move1.state, 'confirmed')

    def test_unreserve_2(self):
        """ Check that unreserving a stock move sets the products reserved as available and
        set the state back to confirmed when they are in a pack.
        """
        stock_location = self.env.ref('stock.stock_location_stock')
        supplier_location = self.env.ref('stock.stock_location_suppliers')
        uom_unit = self.env.ref('product.product_uom_unit')
        product1 = self.env['product.product'].create({
            'name': 'Product A',
            'type': 'product',
            'categ_id': self.env.ref('product.product_category_all').id,
        })
        package1 = self.env['stock.quant.package'].create({'name': 'test_unreserve_2_pack'})

        # make some stock
        self.env['stock.quant'].increase_available_quantity(product1, stock_location, 150.0, package_id=package1)

        # creation
        move1 = self.env['stock.move'].create({
            'name': 'test_putaway_1',
            'location_id': stock_location.id,
            'location_dest_id': supplier_location.id,
            'product_id': product1.id,
            'product_uom': uom_unit.id,
            'product_uom_qty': 100.0,
        })

        self.assertEqual(self.env['stock.quant'].get_available_quantity(product1, stock_location, package_id=package1), 150.0)
        self.assertEqual(move1.availability, 100.0)

        # confirmation
        move1.action_confirm()
        self.assertEqual(move1.state, 'confirmed')

        # assignment
        move1.action_assign()
        self.assertEqual(move1.state, 'assigned')
        self.assertEqual(len(move1.pack_operation_ids), 1)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(product1, stock_location, package_id=package1), 50.0)

        # unreserve
        move1.do_unreserve()
        self.assertEqual(len(move1.pack_operation_ids), 0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(product1, stock_location, package_id=package1), 150.0)
        self.assertEqual(move1.state, 'confirmed')

    def test_link_assign_1(self):
        """ Test the assignment mechanism when two stock moves concerning one unit of an
        untracked product are linked.
        """
        stock_location = self.env.ref('stock.stock_location_stock')
        pack_location = self.env.ref('stock.location_pack_zone')
        customer_location = self.env.ref('stock.stock_location_customers')
        uom_unit = self.env.ref('product.product_uom_unit')
        product1 = self.env['product.product'].create({
            'name': 'Product A',
            'type': 'product',
            'categ_id': self.env.ref('product.product_category_all').id,
        })

        # make some stock
        self.env['stock.quant'].increase_available_quantity(product1, stock_location, 1.0)
        self.assertEqual(len(self.env['stock.quant']._gather(product1, stock_location)), 1.0)

        move_stock_pack = self.env['stock.move'].create({
            'name': 'test_link_assign_1_1',
            'location_id': stock_location.id,
            'location_dest_id': pack_location.id,
            'product_id': product1.id,
            'product_uom': uom_unit.id,
            'product_uom_qty': 1.0,
        })
        move_pack_cust = self.env['stock.move'].create({
            'name': 'test_link_assign_1_2',
            'location_id': pack_location.id,
            'location_dest_id': customer_location.id,
            'product_id': product1.id,
            'product_uom': uom_unit.id,
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
        self.assertEqual(move_line.location_id.id, pack_location.id)
        self.assertEqual(move_line.location_dest_id.id, customer_location.id)
        self.assertEqual(move_pack_cust.state, 'assigned')

    def test_link_assign_2(self):
        """ Test the assignanment mechanism when two stock moves concerning one unit of a
        tracked product are linked.
        """
        stock_location = self.env.ref('stock.stock_location_stock')
        pack_location = self.env.ref('stock.location_pack_zone')
        customer_location = self.env.ref('stock.stock_location_customers')
        uom_unit = self.env.ref('product.product_uom_unit')
        product1 = self.env['product.product'].create({
            'name': 'Product A',
            'type': 'product',
            'categ_id': self.env.ref('product.product_category_all').id,
            'tracking': 'lot',
        })
        lot1 = self.env['stock.production.lot'].create({
            'name': 'lot1',
            'product_id': product1.id,
        })

        # make some stock
        self.env['stock.quant'].increase_available_quantity(product1, stock_location, 1.0, lot_id=lot1)
        self.assertEqual(len(self.env['stock.quant']._gather(product1, stock_location, lot1)), 1.0)

        move_stock_pack = self.env['stock.move'].create({
            'name': 'test_link_2_1',
            'location_id': stock_location.id,
            'location_dest_id': pack_location.id,
            'product_id': product1.id,
            'product_uom': uom_unit.id,
            'product_uom_qty': 1.0,
        })
        move_pack_cust = self.env['stock.move'].create({
            'name': 'test_link_2_2',
            'location_id': pack_location.id,
            'location_dest_id': customer_location.id,
            'product_id': product1.id,
            'product_uom': uom_unit.id,
            'product_uom_qty': 1.0,
        })
        move_stock_pack.write({'move_dest_ids': [(4, move_pack_cust.id, 0)]})
        move_pack_cust.write({'move_orig_ids': [(4, move_stock_pack.id, 0)]})

        (move_stock_pack + move_pack_cust).action_confirm()
        move_stock_pack.action_assign()

        move_line_stock_pack = move_stock_pack.pack_operation_ids[0]
        self.assertEqual(move_line_stock_pack.lot_id.id, lot1.id)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(product1, stock_location, lot_id=lot1), 0.0)
        self.assertEqual(len(self.env['stock.quant']._gather(product1, stock_location, lot1)), 1.0)
        self.assertEqual(len(self.env['stock.quant']._gather(product1, pack_location, lot1)), 0.0)

        move_line_stock_pack.qty_done = 1.0
        move_stock_pack.action_done()
        self.assertEqual(self.env['stock.quant'].get_available_quantity(product1, stock_location, lot_id=lot1), 0.0)
        self.assertEqual(len(self.env['stock.quant']._gather(product1, stock_location, lot1)), 0.0)

        move_line_pack_cust = move_pack_cust.pack_operation_ids[0]
        self.assertEqual(move_line_pack_cust.lot_id.id, lot1.id)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(product1, pack_location, lot_id=lot1), 0.0)
        self.assertEqual(len(self.env['stock.quant']._gather(product1, pack_location, lot1)), 1.0)

    def test_link_assign_3(self):
        """ Test the assignment mechanism when three stock moves (2 sources, 1 dest) concerning
        multiple units of an untracked product.
        """
        stock_location = self.env.ref('stock.stock_location_stock')
        pack_location = self.env.ref('stock.location_pack_zone')
        customer_location = self.env.ref('stock.stock_location_customers')
        uom_unit = self.env.ref('product.product_uom_unit')
        product1 = self.env['product.product'].create({
            'name': 'Product A',
            'type': 'product',
            'categ_id': self.env.ref('product.product_category_all').id,
        })

        # make some stock
        self.env['stock.quant'].increase_available_quantity(product1, stock_location, 2.0)
        self.assertEqual(len(self.env['stock.quant']._gather(product1, stock_location)), 1.0)

        move_stock_pack_1 = self.env['stock.move'].create({
            'name': 'test_link_assign_1_1',
            'location_id': stock_location.id,
            'location_dest_id': pack_location.id,
            'product_id': product1.id,
            'product_uom': uom_unit.id,
            'product_uom_qty': 1.0,
        })
        move_stock_pack_2 = self.env['stock.move'].create({
            'name': 'test_link_assign_1_1',
            'location_id': stock_location.id,
            'location_dest_id': pack_location.id,
            'product_id': product1.id,
            'product_uom': uom_unit.id,
            'product_uom_qty': 1.0,
        })
        move_pack_cust = self.env['stock.move'].create({
            'name': 'test_link_assign_1_2',
            'location_id': pack_location.id,
            'location_dest_id': customer_location.id,
            'product_id': product1.id,
            'product_uom': uom_unit.id,
            'product_uom_qty': 2.0,
        })
        move_stock_pack_1.write({'move_dest_ids': [(4, move_pack_cust.id, 0)]})
        move_stock_pack_2.write({'move_dest_ids': [(4, move_pack_cust.id, 0)]})
        move_pack_cust.write({'move_orig_ids': [(4, [move_stock_pack_1.id, move_stock_pack_2.id], 0)]})

        (move_stock_pack_1 + move_stock_pack_2 + move_pack_cust).action_confirm()

        # assign and fulfill the first move
        move_stock_pack_1.action_assign()
        self.assertEqual(len(move_stock_pack_1.pack_operation_ids), 1)
        move_stock_pack_1.pack_operation_ids[0].qty_done = 1.0
        move_stock_pack_1.action_done()

        # the destination move should be partially available and have one move line
        self.assertEqual(len(move_pack_cust.pack_operation_ids), 1)
        # Should have 1 quant in stock_location and another in pack_location
        self.assertEqual(len(self.env['stock.quant']._gather(product1, stock_location)), 1.0)
        self.assertEqual(len(self.env['stock.quant']._gather(product1, pack_location)), 1.0)

        move_stock_pack_2.action_assign()
        self.assertEqual(len(move_stock_pack_2.pack_operation_ids), 1)
        move_stock_pack_2.pack_operation_ids[0].qty_done = 1.0
        move_stock_pack_2.action_done()

        self.assertEqual(len(self.env['stock.quant']._gather(product1, stock_location)), 0.0)
        self.assertEqual(len(self.env['stock.quant']._gather(product1, pack_location)), 1.0)

        self.assertEqual(len(move_pack_cust.pack_operation_ids), 1)  # FIXME: should merge?
        move_line_1 = move_pack_cust.pack_operation_ids[0]
        self.assertEqual(move_line_1.location_id.id, pack_location.id)
        self.assertEqual(move_line_1.location_dest_id.id, customer_location.id)
        self.assertEqual(move_line_1.product_qty, 2.0)
        self.assertEqual(move_pack_cust.state, 'assigned')

    def test_link_assign_4(self):
        """ Test the assignment mechanism when three stock moves (2 sources, 1 dest) concerning
        multiple units of a tracked by lot product.
        """
        stock_location = self.env.ref('stock.stock_location_stock')
        pack_location = self.env.ref('stock.location_pack_zone')
        customer_location = self.env.ref('stock.stock_location_customers')
        uom_unit = self.env.ref('product.product_uom_unit')
        product1 = self.env['product.product'].create({
            'name': 'Product A',
            'type': 'product',
            'categ_id': self.env.ref('product.product_category_all').id,
            'tracking': 'lot',
        })
        lot1 = self.env['stock.production.lot'].create({
            'name': 'lot1',
            'product_id': product1.id,
        })

        # make some stock
        self.env['stock.quant'].increase_available_quantity(product1, stock_location, 2.0, lot_id=lot1)
        self.assertEqual(len(self.env['stock.quant']._gather(product1, stock_location, lot1)), 1.0)

        move_stock_pack_1 = self.env['stock.move'].create({
            'name': 'test_link_assign_1_1',
            'location_id': stock_location.id,
            'location_dest_id': pack_location.id,
            'product_id': product1.id,
            'product_uom': uom_unit.id,
            'product_uom_qty': 1.0,
        })
        move_stock_pack_2 = self.env['stock.move'].create({
            'name': 'test_link_assign_1_1',
            'location_id': stock_location.id,
            'location_dest_id': pack_location.id,
            'product_id': product1.id,
            'product_uom': uom_unit.id,
            'product_uom_qty': 1.0,
        })
        move_pack_cust = self.env['stock.move'].create({
            'name': 'test_link_assign_1_2',
            'location_id': pack_location.id,
            'location_dest_id': customer_location.id,
            'product_id': product1.id,
            'product_uom': uom_unit.id,
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

        self.assertEqual(len(move_pack_cust.pack_operation_ids), 1)  # FIXME: should merge?
        move_line_1 = move_pack_cust.pack_operation_ids[0]
        self.assertEqual(move_line_1.location_id.id, pack_location.id)
        self.assertEqual(move_line_1.location_dest_id.id, customer_location.id)
        self.assertEqual(move_line_1.product_qty, 2.0)
        self.assertEqual(move_line_1.lot_id.id, lot1.id)
        self.assertEqual(move_pack_cust.state, 'assigned')

    def test_link_assign_5(self):
        """ Test the assignment mechanism when three stock moves (1 sources, 2 dest) concerning
        multiple units of an untracked product.
        """
        stock_location = self.env.ref('stock.stock_location_stock')
        pack_location = self.env.ref('stock.location_pack_zone')
        customer_location = self.env.ref('stock.stock_location_customers')
        uom_unit = self.env.ref('product.product_uom_unit')
        product1 = self.env['product.product'].create({
            'name': 'Product A',
            'type': 'product',
            'categ_id': self.env.ref('product.product_category_all').id,
        })

        # make some stock
        self.env['stock.quant'].increase_available_quantity(product1, stock_location, 2.0)

        move_stock_pack = self.env['stock.move'].create({
            'name': 'test_link_assign_1_1',
            'location_id': stock_location.id,
            'location_dest_id': pack_location.id,
            'product_id': product1.id,
            'product_uom': uom_unit.id,
            'product_uom_qty': 2.0,
        })
        move_pack_cust_1 = self.env['stock.move'].create({
            'name': 'test_link_assign_1_1',
            'location_id': pack_location.id,
            'location_dest_id': customer_location.id,
            'product_id': product1.id,
            'product_uom': uom_unit.id,
            'product_uom_qty': 1.0,
        })
        move_pack_cust_2 = self.env['stock.move'].create({
            'name': 'test_link_assign_1_2',
            'location_id': pack_location.id,
            'location_dest_id': customer_location.id,
            'product_id': product1.id,
            'product_uom': uom_unit.id,
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
