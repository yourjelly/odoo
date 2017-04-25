# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.stock.tests.common import TestStockCommon


class TestStockMove(TestStockCommon):
    def create_pick_ship(self):
        picking_client = self.env['stock.picking'].create({
            'location_id': self.pack_location,
            'location_dest_id': self.customer_location,
            'partner_id': self.partner_delta_id,
            'picking_type_id': self.picking_type_out,
        })

        dest = self.MoveObj.create({
            'name': self.productA.name,
            'product_id': self.productA.id,
            'product_uom_qty': 10,
            'product_uom': self.productA.uom_id.id,
            'picking_id': picking_client.id,
            'location_id': self.pack_location,
            'location_dest_id': self.customer_location,
            'state': 'waiting',
        })
        
        picking_pick = self.env['stock.picking'].create({
            'location_id': self.stock_location,
            'location_dest_id': self.pack_location,
            'partner_id': self.partner_delta_id,
            'picking_type_id': self.picking_type_out,
        })

        self.MoveObj.create({
            'name': self.productA.name,
            'product_id': self.productA.id,
            'product_uom_qty': 10,
            'product_uom': self.productA.uom_id.id,
            'picking_id': picking_pick.id,
            'location_id': self.stock_location,
            'location_dest_id': self.pack_location,
            'move_dest_ids': [(4, dest.id)],
            'state': 'confirmed',
        })
        return picking_pick, picking_client

    def test_mto_moves(self):
        """
            10 in stock, do pick->ship and check ship is assigned when pick is done, then backorder of ship
        """
        picking_pick, picking_client = self.create_pick_ship()
        location = self.env['stock.location'].browse(self.stock_location)

        # make some stock
        self.env['stock.quant'].increase_available_quantity(self.productA, location, 10.0)
        picking_pick.action_assign()
        picking_pick.move_lines[0].pack_operation_ids[0].qty_done = 10.0
        picking_pick.do_transfer()

        self.assertEqual(picking_client.state, 'assigned', 'The state of the client should be assigned')

        # Now partially transfer the ship
        picking_client.move_lines[0].pack_operation_ids[0].qty_done = 5
        picking_client.do_transfer() # no new in order to create backorder

        backorder = self.env['stock.picking'].search([('backorder_id', '=', picking_client.id)])
        self.assertEqual(backorder.state, 'assigned', 'Backorder should be started')

    def test_mto_moves_transfer(self):
        """
            10 in stock, 5 in pack.  Make sure it does not assign the 5 pieces in pack
        """
        picking_pick, picking_client = self.create_pick_ship()
        stock_location = self.env['stock.location'].browse(self.stock_location)
        self.env['stock.quant'].increase_available_quantity(self.productA, stock_location, 10.0)
        pack_location = self.env['stock.location'].browse(self.pack_location)
        self.env['stock.quant'].increase_available_quantity(self.productA, pack_location, 5.0)

        (picking_pick + picking_client).action_assign()

        move_pick = picking_pick.move_lines
        move_cust = picking_client.move_lines
        self.assertEqual(move_pick.state, 'assigned')
        self.assertEqual(picking_pick.state, 'assigned')
        self.assertEqual(move_cust.state, 'waiting')
        self.assertEqual(picking_client.state, 'waiting', 'The picking should not assign what it does not have')
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.productA, stock_location), 0.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.productA, pack_location), 5.0)

        move_pick.pack_operation_ids[0].qty_done = 10.0
        picking_pick.do_transfer()

        self.assertEqual(move_pick.state, 'done')
        self.assertEqual(picking_pick.state, 'done')
        self.assertEqual(move_cust.state, 'assigned')
        self.assertEqual(picking_client.state, 'assigned', 'The picking should not assign what it does not have')
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.productA, stock_location), 0.0)
        self.assertEqual(self.env['stock.quant'].get_available_quantity(self.productA, pack_location), 5.0)

    def test_mto_moves_return(self):
        picking_pick, picking_client = self.create_pick_ship()
        stock_location = self.env['stock.location'].browse(self.stock_location)
        self.env['stock.quant'].increase_available_quantity(self.productA, stock_location, 10.0)

        picking_pick.action_assign()
        picking_pick.move_lines[0].pack_operation_ids[0].qty_done = 10.0
        picking_pick.do_transfer()
        self.assertEqual(picking_pick.state, 'done')
        self.assertEqual(picking_client.state, 'assigned')

        # return a part of what we've done
        stock_return_picking = self.env['stock.return.picking']\
            .with_context(active_ids=picking_pick.ids, active_id=picking_pick.ids[0])\
            .create({})
        stock_return_picking.product_return_moves.quantity = 2.0 # Return only 2
        stock_return_picking_action = stock_return_picking.create_returns()
        return_pick = self.env['stock.picking'].browse(stock_return_picking_action['res_id'])
        return_pick.move_lines[0].pack_operation_ids[0].qty_done = 2.0
        return_pick.do_transfer()
        # the client picking should not be assigned anymore, as we returned partially what we took
        self.assertEqual(picking_client.state, 'confirmed')
