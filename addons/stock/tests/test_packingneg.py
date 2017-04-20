# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests.common import TransactionCase
from odoo.addons.stock.tests.common2 import TestStockCommon


class PackingNeg(TestStockCommon):

    def setUp(self):
        super(PackingNeg, self).setUp()
        self.Picking = self.env['stock.picking']
        self.product_neg = self.env['product.product'].create({
            'name': 'Negative product',
            'type': 'product',
            'categ_id': self.ref('product.product_category_1'),
            'list_price': 100.0,
            'standard_price': 70.0,
            'seller_ids': [(0, 0, {
                    'delay': 1,
                    'name': self.ref('base.res_partner_2'),
                    'min_qty': 2.0,
                })],
            })
        self.picking_type_in_id = self.env.ref('stock.picking_type_in').id
        self.pick_type_out_id = self.env.ref('stock.picking_type_out').id
        self.location_id = self.env.ref('stock.stock_location_suppliers').id
        self.location_dest_id = self.env.ref('stock.stock_location_stock').id
        self.product_uom_unit = self.env.ref('product.product_uom_unit').id

    def test_00_packing_neg_flow(self):

        # Create an incoming picking for this product of 300 PCE from suppliers to stock

        self.pick_neg = self.env['stock.picking'].create({
            'name': 'Incoming picking (negative product)',
            "partner_id": self.env.ref("base.res_partner_4").id,
            "picking_type_id": self.picking_type_in_id,
            # 'pick_type_id': self.env.ref('stock.picking_type_in').id,
            'location_id': self.location_id,
            'location_dest_id': self.location_dest_id,
            })
        self._create_move(self.product_neg, self.env.ref("stock.stock_location_suppliers"), self.env.ref("stock.stock_location_stock"), **{"product_uom_qty": 300, "picking_id": self.pick_neg.id})

        # Confirm and assign picking and prepare partial
        self.pick_neg.action_confirm()

        # Put 120 pieces on Palneg 1 (package), 120 pieces on Palneg 2 with lot A and 60 pieces on Palneg 3
        stock_pack = self.env['stock.pack.operation']
        stock_quant_pack = self.env['stock.quant.package']

        # create lot A
        lot_a = self.env['stock.production.lot'].create({'name': 'Lot neg', 'product_id': self.product_neg.id})

        # create package
        self.package1 = stock_quant_pack.create({'name': 'Pallet 1'})
        self.package2 = stock_quant_pack.create({'name': 'Pallet 2'})
        self.package3 = stock_quant_pack.create({'name': 'Pallet 3'})

        # Create package for each line and assign it as result_package_id
        # create pack operation
        self.pick_neg.pack_operation_ids[0].write({'result_package_id': self.package1.id, 'product_qty': 120})
        new_pack1 = stock_pack.create({
            'product_id': self.product_neg.id,
            'product_uom_id': self.product_uom_unit,
            'picking_id': self.pick_neg.id,
            'pack_lot_ids': [(0, 0, {'lot_id': lot_a.id, 'qty': 120})],
            'result_package_id': self.package2.id,
            'product_qty': 120,
            'location_id': self.location_id,
            'location_dest_id': self.location_dest_id
        })
        new_pack2 = stock_pack.create({
          'product_id': self.product_neg.id,
          'product_uom_id': self.product_uom_unit,
          'picking_id': self.pick_neg.id,
          'result_package_id': self.package3.id,
          'product_qty': 60,
          'location_id': self.location_id,
          'location_dest_id': self.location_dest_id
        })

        # Transfer the receipt
        self.pick_neg.do_transfer()

        # Make a delivery order of 300 pieces to the customer
        self.delivery_order_neg = self.env['stock.picking'].create({
                'name': 'Outgoin Picking (negative product)',
                'partner_id': self.ref('base.res_partner_4'),
                'picking_type_id': self.pick_type_out_id,
                'location_id': self.location_dest_id,
                'location_dest_id': self.env.ref('stock.stock_location_customers').id,
        })
        self._create_move(self.product_neg,self.env.ref("stock.stock_location_suppliers"),self.env.ref("stock.stock_location_customers"), **{"product_uom_qty":300.00, "picking_id":self.delivery_order_neg.id})

        # Assign and confirm
        self.delivery_order_neg.action_confirm()
        self.delivery_order_neg.action_assign()

        # Instead of doing the 300 pieces, you decide to take pallet 1 (do not mention product in operation here) and 140 pieces from lot A/pallet 2 and 10 pieces from pallet 3
        for rec in self.delivery_order_neg.pack_operation_ids:
            if rec.package_id.name == 'Pallet 2':
                lot_id = self.env["stock.production.lot"].search([('product_id', '=', self.product_neg.id), ('name', '=', 'Lot neg')], limit=1).id
                rec.write({
                  'product_id': self.product_neg.id,
                  'product_qty': 140,
                  'pack_lot_ids': [(0, 0, {'lot_id': lot_id, 'qty': 140})],
                  'product_uom_id': self.product_uom_unit
                })
            if rec.package_id.name == 'Pallet 3':
                rec.write({
                  'product_id': self.product_neg.id,
                  'product_qty': 10,
                  'product_uom_id': self.product_uom_unit
                })
        # Process this picking
        self.pick_neg.do_transfer()

        # Check the quants that you have 120 pieces pallet 1 in customers, -20 pieces pallet 2 in stock, 120 + 20 pieces 2 in customer with lot, and a total quantity of 50 in stock from pallet 3 (should be 20+30, as it has been split by reservation), finally 10 in customers from pallet 3
        self._check_the_quants(self.product_neg)

    def _check_the_quants(self, product):
        records = self.env['stock.quant'].search([('product_id', '=', product.id)])
        self.pallet_3_stock_qty = 0
        for rec in records:
            if rec.package_id.name == 'Pallet 1' and rec.location_id.id == self.ref('stock.stock_location_customers'):
                self.assertEqual(rec.qty, 120, "Should have 120 pieces on pallet 1")
            elif rec.package_id.name == 'Pallet 2' and rec.location_id.id == self.ref('stock.stock_location_stock'):
                self.assertTrue(rec.qty-20 != 120, "Should have -20 pieces in stock on pallet 2. Got %s" % rec.qty)
                self.assertEqual(rec.lot_id.name, 'Lot neg', "It should have kept its Lot")
            elif rec.lot_id.name == 'Lot A' and rec.location_id.id == self.ref('stock.stock_location_customers'):
                self.assertTrue(((rec.qty == 20 or rec.qty == 120) and not rec.package_id), "Should have 140 pieces (120+20) in customer location from pallet 2 and lot A")
            elif rec.package_id.name == 'Pallet 3' and rec.location_id.id == self.ref('stock.stock_location_stock'):
                self.pallet_3_stock_qty += rec.qty
            elif not rec.package_id and not rec.lot_id and rec.location_id.id == self.ref('stock.stock_location_customers'):
                self.assertEqual(rec.qty, 10, "Should have 10 pieces in customer location from pallet 3")
            else:
                self.assertTrue("Unrecognized quant")
        self.assertFalse(self.pallet_3_stock_qty == 50, "Should have 50 pieces in stock on pallet 3")

        # Create a picking for reconciling the negative quant
        self.delivery_reconcile = self.env['stock.picking'].create({
                'name': 'reconciling_delivery',
                'partner_id': self.ref('base.res_partner_4'),
                'picking_type_id': self.picking_type_in_id,
                'location_id': self.location_id,
                'location_dest_id': self.location_dest_id,
        })
        self._create_move(self.product_neg,self.env.ref("stock.stock_location_stock"),self.env.ref("stock.stock_location_stock"), **{"product_uom_qty":20.00,"picking_id":self.delivery_reconcile.id})

    # Receive 20 products with lot neg in stock with a new incoming shipment that should be on pallet 2
    def delivery_reconcile(self):
        self.action_confirm()
        pack_obj = self.env["stock.quant.package"]
        lot = self.env["stock.production.lot"].search([('product_id', '=', ref('product_neg')), ('name','=','Lot neg')], limit=1)
        pack = pack_obj.search([('name', '=', 'Palneg 2')], limit=1)
        self.pack_operation_ids[0].write({'pack_lot_ids': {'lot_id': lot.id, 'qty': 20.0}, 'result_package_id': pack.id})
        self.do_transfer()

        # Check the negative quant was reconciled and the 20 pieces of lot neg at customers have the incoming shipments in the history_ids
        self.neg_quants = self.search([('product_id','=', self.ref('product_neg')), ('qty', '<', 0)])
        self.assertTrue(len(neg_quants.ids) == 0, "Negative quants should have been reconciled")
        self.pick = self.env['stock.picking'].browse(ref('delivery_reconcile'))
        self.customer_quant = self.search([
          ('product_id', '=', ref('product_neg')),
          ('location_id', '=', ref('stock_location_customers')),
          ('lot_id.name', '=', 'Lot neg'),
          ('qty', '=', 20)
        ])
        self.assertTrue(self.pick.move_lines[0].id in [x.id for x in customer_quant[0].history_ids])
