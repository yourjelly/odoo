from odoo.addons.stock_dropshipping.tests.common import TestStockDropshippingCommon


class TestCrossdock(TestStockDropshippingCommon):

    def test_crossdock(self):
        """ Test the Sales/Purchase order flow """

        # Creating Sale Order
        sale_order_crossdock_shpng = self.SaleOrder.create({'partner_id': self.partner.id,
                                            'note': "Create Sales order",
                                            'warehouse_id': self.warehouse.id,
                                            'order_line': [(0, 0, {'product_id':self.product.id,
                                            'product_uom_qty': 100.0})],
                                            })

        # Writeing Route_id
        route_wh_pps_crossdock = self.warehouse.crossdock_route_id.id
        sale_order_crossdock_shpng.order_line.write({'route_id': route_wh_pps_crossdock})

        # Confirmimg Sale Order
        sale_order_crossdock_shpng.action_confirm()

        # Run Scheduler
        self.ProcurementOrder.run_scheduler()

        # Searching Purchase Order by their     state
        po = self.PurchaseOrder.search([('id', '=', self.partner.id), ('state', '=', 'draft')])

        # Confirmimg Purchase Order
        po.button_confirm()
