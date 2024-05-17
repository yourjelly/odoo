# Part of Odoo. See LICENSE file for full copyright and licensing details.
import odoo
from odoo.tests import Form, HttpCase, tagged, TransactionCase
from odoo.tests import Form, TransactionCase


@tagged('-at_install', 'post_install')
class TestStockReportTour(HttpCase, ):

    def _get_report_url(self):
        return '/web#&model=product.template&action=stock.product_template_action_product'

    def test_stock_route_diagram_report(self):
        """ Open the route diagram report."""
        url = self._get_report_url()

        self.start_tour(url, 'test_stock_route_diagram_report', login='admin', timeout=180)

    def test_location_report(self):
        stock_location_1 = self.env['stock.location'].create({
            'name': 'stock_location_1',
            'usage': 'internal',
        })
        stock_location_2 = self.env['stock.location'].create({
            'name': 'stock_location_2',
            'usage': 'internal',
        })
        prod = self.env['product.product'].create({
            'name': 'fake prod',
            'type': 'product'
        })
        self.env['stock.quant']._update_available_quantity(prod, stock_location_1, 10)
        action_id = self.env.ref('stock.action_view_quants')
        url = "/web#action=" + str(action_id.id)
        self.start_tour(url, 'test_location_report', login='admin')
