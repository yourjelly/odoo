from odoo.addons.stock.tests.common2 import TestStockCommon


class TestPacking(TestStockCommon):

    def test_create_packing(self):
        """ Test packaging with shipments"""

        # Create a new stackable product """
        self.product1 = self.Product.create({
                            "name": "Nice product",
                            "type": "product",
                            "categ_id": self.ref("product.product_category_1"),
                            "list_price": 100.0,
                            "standard_price": 70.0,
                            "seller_ids": [(0, 0, {"delay": 1,
                                                   "name": self.partner2_id,
                                                   "min_qty": 2.0})],
                    })

        # Create an incoming picking for this product of 300 PCE from suppliers to stock
        self.picking1 = self.StockPicking.create({
                        "name": "Incoming picking",
                        "partner_id": self.partner2_id,
                        "picking_type_id": self.picking_type_in_id,
                        "location_id": self.supplier_location_id,
                        "location_dest_id": self.stock_location_id
            })
        self._create_move(self.product1, self.supplier_location_id, self.stock_location_id, **{"product_uom_qty": 300, "picking_id": self.picking1.id})
        # Confirm and assign picking and prepare partial
        self.picking1.action_confirm()
        self.picking1.do_prepare_partial()

        # ----------------------------------------------------------------------
        # Put 120 pieces on Pallet 1 (package), 120 pieces on Pallet 2 with lot A and 60 pieces on Pallet 3
        # ----------------------------------------------------------------------

        # Change quantity of first to 120 and create 2 others quant operations

        # create lot A
        lot_a = self.ProductionLot.create({'name': 'Lot A', 'product_id': self.product1.id})
        # create package
        package1 = self.Package.create({'name': 'Pallet 1'})
        package2 = self.Package.create({'name': 'Pallet 2'})
        package3 = self.Package.create({'name': 'Pallet 3'})
        # Create package for each line and assign it as result_package_id
        # create pack operation
        self.picking1.pack_operation_ids[0].write({'result_package_id': package1.id, 'product_qty': 120})
        self.PackOperation.create({
          'product_id': self.product1.id,
          'product_uom_id': self.uom_unit_id,
          'picking_id': self.picking1.id,
          'pack_lot_ids': [(0, 0, {'lot_id': lot_a.id, 'qty': 120})],
          'result_package_id': package2.id,
          'product_qty': 120,
          'location_id': self.supplier_location_id,
          'location_dest_id': self.stock_location_id
        })
        self.PackOperation.create({
          'product_id': self.product1.id,
          'product_uom_id': self.uom_unit_id,
          'picking_id': self.picking1.id,
          'result_package_id': package3.id,
          'product_qty': 60,
          'location_id': self.supplier_location_id,
          'location_dest_id': self.stock_location_id
        })

        # Transfer the receipt
        self.picking1.do_transfer()
        # Check the system created 3 quants one with 120 pieces on pallet 1, one with 120 pieces on pallet 2 with lot A and 60 pieces on pallet 3
        self._check_system_created_quants(self.product1)
        # Check there is no backorder or extra moves created
        self._check_no_back_order(self.picking1)
        # Make a delivery order of 300 pieces to the customer
        self.delivery_order1 = self.StockPicking.create({
                                    "name": "outgoing picking",
                                    "partner_id": self.env.ref("base.res_partner_4").id,
                                    "picking_type_id": self.picking_type_out_id,
                                    "location_id": self.stock_location_id,
                                    "location_dest_id": self.customer_location_id
                            })
        self._create_move(self.product1, self.stock_location_id, self.customer_location_id, **{"product_uom_qty": 300.00, "picking_id": self.delivery_order1.id})
        # Assign and confirm
        self.delivery_order1.action_confirm()
        self.delivery_order1.action_assign()
        # Instead of doing the 300 pieces, you decide to take pallet 1 (do not mention product in operation here) and 20 pieces from lot A and 10 pieces from pallet 3
        self.delivery_order1.do_prepare_partial()
        for rec in self.delivery_order1.pack_operation_ids:
            if rec.package_id.name == 'Pallet 2':
                lot = self.ProductionLot.search([('product_id', '=', self.product1.id), ('name', '=', 'Lot A')], limit=1)
                rec.write({
                  'product_id': self.product1.id,
                  'product_qty': 20,
                  'pack_lot_ids': [(0, 0, {'lot_id': lot.id, 'qty': 20})],
                  'product_uom_id': self.uom_unit_id
                })
            if rec.package_id.name == 'Pallet 3':
                rec.write({
                  'product_id': self.product1.id,
                  'product_qty': 10,
                  'product_uom_id': self.uom_unit_id
                })
        # Process this picking
        self.delivery_order1.do_transfer()
        # Check the quants that you have 120 pieces pallet 1 in customers, 100 pieces pallet 2 in stock and 20 with customers and 50 in stock, 10 in customers from pallet 3
        self._check_the_quants(self.product1)
        # Check a backorder was created and on that backorder, prepare partial and process backorder
        backorders = self.StockPicking.search([('backorder_id', '=', self.delivery_order1.id)])
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
        product_quants = self.StockQuant.search([('product_id', '=', self.product1.id), ('location_id', '=', self.stock_location_id)])
        total_qty = sum(product_quants.mapped('qty'))
        self.assertEqual(total_qty, 0, "Total quantity in stock should be 0 as the backorder took everything out of stock")
        self.assertEqual(self.product1.qty_available, 0, "Quantity available should be 0 too")

    def _check_system_created_quants(self, product):
        quants = self.StockQuant.search([('product_id', '=', product.id)])
        self.assertEqual(len(quants.ids), 3, "The number of quants created is not correct")
        for quant in quants:
            if quant.package_id.name == 'Pallet 1':
                self.assertEqual(quant.qty, 120, "Should have 120 pieces on pallet 1")
            elif quant.package_id.name == 'Pallet 2':
                self.assertEqual(quant.qty, 120, "Should have 120 pieces on pallet 2")
            elif quant.package_id.name == 'Pallet 3':
                self.assertEqual(quant.qty, 60, "Should have 60 pieces on pallet 3")

    def _check_no_back_order(self, picking):
        backorder = self.StockPicking.search([('backorder_id', '=', picking.id)])
        self.assertFalse(backorder)
        # Check extra moves created
        self.assertEqual(len(picking.move_lines), 1)

    def _check_the_quants(self, product):
        product_quants = self.StockQuant.search([('product_id', '=', product.id)])
        for quant in product_quants:
            if quant.package_id.name == 'Pallet 1' and quant.location_id.id == self.customer_location_id:
                self.assertEqual(quant.qty, 120, "Should have 120 pieces on pallet 1, got %s" % quant.qty)
            elif quant.package_id.name == 'Pallet 2' and quant.location_id.id == self.stock_location_id:
                self.assertEqual(quant.qty, 100, "Should have 100 pieces on pallet 2, got %s" % quant.qty)
            elif quant.lot_id.name == 'Lot A' and quant.location_id.id == self.customer_location_id:
                self.assertTrue((quant.qty == 20 and not quant.package_id), "Should have 20 pieces in customer location from pallet 2")
            elif quant.package_id.name == 'Pallet 3' and quant.location_id.id == self.stock_location_id:
                self.assertEqual(quant.qty, 50, "Should have 50 pieces in stock on pallet 3")
            elif not quant.package_id and not quant.lot_id and quant.location_id.id == self.customer_location_id:
                self.assertEqual(quant.qty, 10, "Should have 10 pieces in customer location from pallet 3")
            else:
                self.assertFalse(True, "Unrecognized quant")
