from odoo.addons.stock.tests.common2 import TestStockCommon


class TestProcrule(TestStockCommon):
    def setUp(self):
        super(TestProcrule, self).setUp()
        self.PickingObj = self.env['stock.picking']
        self.product_route = self.env['stock.location.route'].create({
            "name": "Stock -> output rule",
            "product_selectable": True,
            "pull_ids": [(0, 0, {
                "name": "Stock -> output rule",
                "action": "move",
                "picking_type_id": self.ref("stock.picking_type_internal"),
                "location_src_id": self.ref("stock.stock_location_stock"),
                "location_id": self.ref("stock.stock_location_output"),
                })]
        })
        # Set route on `product.product_product_3
        self.product_3.write({'route_ids': [(4, self.product_route.id)]})
        # Create Delivery Order of 10 `product.product_product_3` from Output -> Customer
        self.pick_output = self.PickingObj.create({
                            "name": "Delivery order for procurement",
                            "partner_id": self.ref("base.res_partner_2"),
                            "picking_type_id": self.ref("stock.picking_type_out"),
                            "location_id": self.ref("stock.stock_location_output"),
                            "location_dest_id": self.ref("stock.stock_location_customers")})
        self.picking_out = self.PickingObj.browse(self.pick_output.id)

    def test_create_product_route(self):
        """  Create a product route containing a procurement rule that will
      generate a move from Stock for every procurement created in Output """
        # Create Move
        self._create_move(self.product_3, self.env.ref("stock.stock_location_output"), self.env.ref("stock.stock_location_output"), **{"product_uom_qty": 10.0, "procure_method": "make_to_order", "picking_id": self.pick_output.id})
        # Confirm delivery order.
        self.pick_output.action_confirm()
        # I run the scheduler.
        self.env['procurement.order'].run_scheduler()
        # Check that a picking was created from stock to output.
        moves = self.env['stock.move'].search([
          ('product_id', '=', self.product_3.id),
          ('location_id', '=', self.ref('stock.stock_location_stock')),
          ('location_dest_id', '=', self.ref("stock.stock_location_output")),
          ('move_dest_id', '=', self.picking_out.move_lines[0].id)
        ])
        # It should have created a picking from Stock to Output with the original picking as destination
        self.assertEqual(len(moves.ids), 1)
