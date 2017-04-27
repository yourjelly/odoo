# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests.common import TransactionCase
from odoo.addons.stock.tests.common2 import TestStockCommon


class TestStockMove(TestStockCommon):
    
    def test_merge_moves(self):
        group1 = self.env['procurement.group'].create({'name': 'group1'})
        group2 = self.env['procurement.group'].create({'name': 'group2'})
        # Will be another test
        
        
    def test_mto_moves(self):
        picking_client = self.env['stock.picking'].create({'location_id': self.pack_location,
                                          'location_dest_id': self.customer_location,
                                          'partner_id': self.partner_delta_id,
                                          'picking_type_id': self.picking_type_in,})
        dest = self.MoveObj.create({
            'name': self.productA.name,
            'product_id': self.productA.id,
            'product_uom_qty': 10,
            'product_uom': self.productA.uom_id.id,
            'picking_id': picking_client.id,
            'location_id': self.supplier_location,
            'location_dest_id': self.stock_location})
        
        
        picking_pick = self.env['stock.picking'].create({'location_id': self.pack_location,
                                          'location_dest_id': self.customer_location,
                                          'partner_id': self.partner_delta_id,
                                          'picking_type_id': self.picking_type_in,})
        
        self.MoveObj.create({
            'name': self.productA.name,
            'product_id': self.productA.id,
            'product_uom_qty': 10,
            'product_uom': self.productA.uom_id.id,
            'picking_id': picking_pick.id,
            'location_id': self.stock_location,
            'location_dest_id': self.pack_location,
            'move_dest_ids': [(4, dest.id)]
            })

        self.env['stock.quant'].increase_available_quantity(self.productA, self.stock_location, 10.0)
        picking_pick.action_assign()
        picking_pick.do_new_transfer()
        
        self.assertEqual(picking_client.state, 'assigned', 'The state of the client should be assigned')
        
        # Now partially transfer the ship
        picking_pick.action_assign()
        picking_pick.move_lines[0].pack_operation_ids[0].qty_done = 5
        picking_pick.do_transfer() # no new in order to create backorder
        
        backorder = self.env['stock.picking'].search([('backorder_id', '=', picking_pick.id)])
        self.assertEqual(backorder.state, 'assigned', 'Backorder should be started')
        
    
    def test_mto_moves_transfer(self):
        picking_client = self.env['stock.picking'].create({'location_id': self.pack_location,
                                          'location_dest_id': self.customer_location,
                                          'partner_id': self.partner_delta_id,
                                          'picking_type_id': self.picking_type_in,})
        dest = self.MoveObj.create({
            'name': self.productA.name,
            'product_id': self.productA.id,
            'product_uom_qty': 10,
            'product_uom': self.productA.uom_id.id,
            'picking_id': picking_client.id,
            'location_id': self.supplier_location,
            'location_dest_id': self.stock_location})
        
        
        picking_pick = self.env['stock.picking'].create({'location_id': self.pack_location,
                                          'location_dest_id': self.customer_location,
                                          'partner_id': self.partner_delta_id,
                                          'picking_type_id': self.picking_type_in,})
        self.MoveObj.create({
            'name': self.productA.name,
            'product_id': self.productA.id,
            'product_uom_qty': 10,
            'product_uom': self.productA.uom_id.id,
            'picking_id': picking_pick.id,
            'location_id': self.stock_location,
            'location_dest_id': self.pack_location,
            'move_dest_ids': [(4, dest.id)]
            })
        
        self.env['stock.quant'].increase_available_quantity(self.productA, self.stock_location, 10.0)
        self.env['stock.quant'].increase_available_quantity(self.productA, self.pack_location, 5.0)
        
        picking_pick.action_assign()
        self.assertEqual(picking_pick.state, 'waiting', 'The picking should not assign what it does not have')
        
        
        