from odoo.addons.stock.tests.common2 import TestStockCommon


class TestPacking(TestStockCommon):
    """  """
    def test_create_packing(self):
        """ Create a new stockable product """
        self.product1 = self.env['product.product'].create({
                            "name": "Nice product",
                            "type": "product",
                            "categ_id": self.env.ref("product.product_category_1").id,
                            "list_price": 100.0,
                            "standard_price": 70.0,
                            "uom_id": self.env.ref("product.product_uom_unit").id,
                            "uom_po_id": self.env.ref("product.product_uom_unit").id,
                            "seller_ids": [(0, 0, {"delay": 1,
                                                   "name": self.ref("base.res_partner_2"),
                                                   "min_qty": 2.0})],
                    })
        # Create an incoming picking for this product of 300 PCE from suppliers to stock
        self.pick1 = self.env['stock.picking'].create({
                        "name": "Incoming picking",
                        "partner_id": self.env.ref("base.res_partner_2").id,
                        "picking_type_id": self.env.ref("stock.picking_type_in").id,
                        "location_id": self.env.ref("stock.stock_location_suppliers").id,
                        "location_dest_id": self.env.ref("stock.stock_location_stock").id
            })
        self._create_move(self.product1,self.env.ref("stock.stock_location_suppliers"), self.env.ref("stock.stock_location_stock"), **{"product_uom_qty":300, "picking_id":self.pick1.id})
        # Confirm and assign picking and prepare partial
        self.pick1.action_confirm()
        self.pick1.do_prepare_partial()
        # Put 120 pieces on Pallet 1 (package), 120 pieces on Pallet 2 with lot A and 60 pieces on Pallet 3
        # Change quantity of first to 120 and create 2 others quant operations
        stock_pack = self.env['stock.pack.operation']
        stock_quant_pack = self.env['stock.quant.package']
        # create lot A
        lot_a = self.env['stock.production.lot'].create({'name': 'Lot A', 'product_id': self.product1.id})
        # create package
        package1 = stock_quant_pack.create({'name': 'Pallet 1'})
        package2 = stock_quant_pack.create({'name': 'Pallet 2'})
        package3 = stock_quant_pack.create({'name': 'Pallet 3'})
        # Create package for each line and assign it as result_package_id
        # create pack operation
        self.pick1.pack_operation_ids[0].write({'result_package_id': package1.id, 'product_qty': 120})
        new_pack1 = stock_pack.create({
          'product_id': self.product1.id,
          'product_uom_id': self.env.ref('product.product_uom_unit').id,
          'picking_id': self.pick1.id,
          'pack_lot_ids': [(0, 0, {'lot_id': lot_a.id, 'qty': 120})],
          'result_package_id': package2.id,
          'product_qty': 120,
          'location_id': self.env.ref('stock.stock_location_suppliers').id,
          'location_dest_id': self.env.ref('stock.stock_location_stock').id
        })
        new_pack2 = stock_pack.create({
          'product_id': self.product1.id,
          'product_uom_id': self.env.ref('product.product_uom_unit').id,
          'picking_id': self.pick1.id,
          'result_package_id': package3.id,
          'product_qty': 60,
          'location_id': self.env.ref('stock.stock_location_suppliers').id,
          'location_dest_id': self.env.ref('stock.stock_location_stock').id
        })

        # Transfer the receipt
        self.pick1.do_transfer()
        # Check the system created 3 quants one with 120 pieces on pallet 1, one with 120 pieces on pallet 2 with lot A and 60 pieces on pallet 3
        self._check_system_created_quants(self.product1)
        # Check there is no backorder or extra moves created
        self._check_no_back_order(self.pick1)
        # Make a delivery order of 300 pieces to the customer
        self.delivery_order1 = self.env['stock.picking'].create({
                                    "name": "outgoing picking",
                                    "partner_id": self.env.ref("base.res_partner_4").id,
                                    "picking_type_id": self.env.ref("stock.picking_type_out").id,
                                    "location_id": self.env.ref("stock.stock_location_stock").id,
                                    "location_dest_id": self.env.ref("stock.stock_location_customers").id
                            })
        self._create_move(self.product1,self.env.ref("stock.stock_location_stock"),self.env.ref("stock.stock_location_customers"),**{"product_uom_qty":300.00,"picking_id":self.delivery_order1.id})
        # Assign and confirm
        self.delivery_order1.action_confirm()
        self.delivery_order1.action_assign()
        # Instead of doing the 300 pieces, you decide to take pallet 1 (do not mention product in operation here) and 20 pieces from lot A and 10 pieces from pallet 3
        stock_pack = self.env['stock.pack.operation']
        self.delivery_order1.do_prepare_partial()
        for rec in self.delivery_order1.pack_operation_ids:
            if rec.package_id.name == 'Pallet 2':
                lot = self.env["stock.production.lot"].search([('product_id', '=', self.product1.id), ('name', '=', 'Lot A')], limit=1)
                rec.write({
                  'product_id': self.product1.id,
                  'product_qty': 20,
                  'pack_lot_ids': [(0, 0, {'lot_id': lot.id, 'qty': 20})],
                  'product_uom_id': self.env.ref('product.product_uom_unit').id
                })
            if rec.package_id.name == 'Pallet 3':
                rec.write({
                  'product_id': self.product1.id,
                  'product_qty': 10,
                  'product_uom_id': self.env.ref('product.product_uom_unit').id
                })
        # Process this picking
        self.delivery_order1.do_transfer()
        # Check the quants that you have 120 pieces pallet 1 in customers, 100 pieces pallet 2 in stock and 20 with customers and 50 in stock, 10 in customers from pallet 3
        self._check_the_quants(self.product1)
        # Check a backorder was created and on that backorder, prepare partial and process backorder
        backorders = self.env['stock.picking'].search([('backorder_id', '=', self.delivery_order1.id)])
        self.assertTrue(backorders, "Backorder should have been created")
        backorders.action_assign()
        backorders.do_prepare_partial()
        picking = backorders[0]
        self.assertEqual(len(picking.pack_operation_ids), 2, "Wrong number of pack operation")
        for pack_op in picking.pack_operation_ids:
            self.assertEqual(pack_op.product_qty, 1, "Wrong quantity in pack operation (%s found instead of 1)" % (pack_op.product_qty))
            self.assertTrue((pack_op.package_id.name in ('Pallet 2', 'Pallet 3')), "Wrong pallet info in pack operation (%s found)" % (pack_op.package_id.name))
        backorders.do_transfer()
        # Check there are still 0 pieces in stock
        records = self.env['stock.quant'].search([('product_id', '=', self.product1.id), ('location_id', '=', self.ref('stock.stock_location_stock'))])
        total_qty = 0
        for rec in records:
            total_qty += rec.qty
        product = self.env["product.product"].browse(self.product1.id)
        self.assertEqual(total_qty, 0, "Total quantity in stock should be 0 as the backorder took everything out of stock")
        self.assertEqual(product.qty_available, 0, "Quantity available should be 0 too")

    def _check_system_created_quants(self, product):
        quants = self.env['stock.quant'].search([('product_id', '=', product.id)])
        self.assertEqual(len(quants.ids), 3, "The number of quants created is not correct")
        for quant in quants:
            if quant.package_id.name == 'Pallet 1':
                self.assertEqual(quant.qty, 120, "Should have 120 pieces on pallet 1")
            elif quant.package_id.name == 'Pallet 2':
                self.assertEqual(quant.qty, 120, "Should have 120 pieces on pallet 2")
            elif quant.package_id.name == 'Pallet 3':
                self.assertEqual(quant.qty, 60, "Should have 60 pieces on pallet 3")

    def _check_no_back_order(self, picking):
        backorder = self.env['stock.picking'].search([('backorder_id', '=', picking.id)])
        self.assertFalse(backorder)
        # Check extra moves created
        self.assertEqual(len(picking.move_lines), 1)

    def _check_the_quants(self, product):
        records = self.env['stock.quant'].search([('product_id', '=', product.id)])
        for rec in records:
            if rec.package_id.name == 'Pallet 1' and rec.location_id.id == self.ref('stock.stock_location_customers'):
                self.assertEqual(rec.qty, 120, "Should have 120 pieces on pallet 1, got %s" % rec.qty)
            elif rec.package_id.name == 'Pallet 2' and rec.location_id.id == self.ref('stock.stock_location_stock'):
                self.assertEqual(rec.qty, 100, "Should have 100 pieces on pallet 2, got %s" % rec.qty)
            elif rec.lot_id.name == 'Lot A' and rec.location_id.id == self.ref('stock.stock_location_customers'):
                self.assertTrue((rec.qty == 20 and not rec.package_id), "Should have 20 pieces in customer location from pallet 2")
            elif rec.package_id.name == 'Pallet 3' and rec.location_id.id == self.ref('stock.stock_location_stock'):
                self.assertEqual(rec.qty, 50, "Should have 50 pieces in stock on pallet 3")
            elif not rec.package_id and not rec.lot_id and rec.location_id.id == self.ref('stock.stock_location_customers'):
                self.assertEqual(rec.qty, 10, "Should have 10 pieces in customer location from pallet 3")
            else:
                self.assertFalse(True, "Unrecognized quant")
