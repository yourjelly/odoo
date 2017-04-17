
from odoo.tests import common
from odoo import tools
from odoo.modules.module import get_module_resource
import time


class TestFifoReturns(common.TransactionCase):

    def _load(self, module, *args):
        tools.convert_file(
            self.cr, 'purchase',
            get_module_resource(module, *args), {}, 'init', False, 'test', self.registry._assertion_report)

    def setUp(self):
        super(TestFifoReturns, self).setUp()

        # Useful models
        self.product_model = self.env['product.product']
        self.PurchaseOrder = self.env['purchase.order']
        self.StockPicking = self.env['stock.picking']
        self.Account = self.env['account.account']

        # Reference
        self.uom_id = self.ref('product.product_uom_kgm')

    def create_purchase_order(self, product, product_qty=0.0, price_unit=0.0):
        """ I create a draft Purchase Order """

        po_vals = {
            'partner_id': self.ref('base.res_partner_3'),
            'order_line': [
                (0, 0, {
                    'name': product.name,
                    'product_id': product.id,
                    'product_qty': product_qty,
                    'product_uom': self.uom_id,
                    'price_unit': price_unit,
                    'date_planned': time.strftime('%Y-%m-%d'),
                })],
        }
        return self.PurchaseOrder.create(po_vals)

    def test_fifo_returns(self):
        """Test to create product and purchase order to test the FIFO returns of the product"""

        self._load('account', 'test', 'account_minimal_test.xml')
        self._load('stock_account', 'test', 'stock_valuation_account.xml')

        """ Set a product as using fifo price"""
        self.product_fiforet_icecream = self.product_model.create({
            'default_code': 'FIFORET',
            'name': 'FIFO Ice Cream',
            'type': 'product',
            'standard_price': 0.0,
            'categ_id': self.ref('product.product_category_1'),
            'uom_id': self.uom_id,
            'uom_po_id': self.uom_id,
            'cost_method': 'real',
            'valuation': 'real_time',
            'property_stock_account_input': self.ref('purchase.o_expense'),
            'property_stock_account_output': self.ref('purchase.o_income'),
            'description': 'FIFO Ice Cream can be mass - produced and thus is widely available in developed parts of the world. Ice cream can be purchased in large cartons(vats and squrounds) from supermarkets and grocery stores, in smaller quantities from ice cream shops, convenience stores, and milk bars, and in individual servings from small carts or vans at public events.'
        })

        # I create a draft Purchase Order for first in move for 10 kg at 50
        # euro
        self.purchase_order_1 = self.create_purchase_order(product=self.product_fiforet_icecream,
                                                           product_qty=10.0, price_unit=50.0)

        # I create a draft Purchase Order for second shipment for 30 kg at 80
        # euro
        self.purchase_order_2 = self.create_purchase_order(product=self.product_fiforet_icecream,
                                                           product_qty=30.0, price_unit=80.0)

        # I confirm the first purchase order
        self.purchase_order_1.button_confirm()

        # Process the reception of purchase order 1
        self.purchase_order_1.picking_ids[0].do_transfer()

        # Check the standard price of the product (fifo icecream)
        self.assertEqual(self.product_fiforet_icecream.standard_price,
                         0.0, 'Standard price should not have changed!')

        # I confirm the second purchase order
        self.purchase_order_2.button_confirm()

        # Process the reception of purchase order 2
        self.purchase_order_2.picking_ids[0].do_transfer()

        # Return the goods of purchase order 2
        picking = self.purchase_order_2.picking_ids[0]
        return_pick_wiz = self.env['stock.return.picking'].with_context(
            active_model='stock.picking', active_id=picking.id).create({})
        return_picking_id, dummy = return_pick_wiz._create_returns()

        return_picking = self.StockPicking.browse(return_picking_id)
        return_picking.action_confirm()
        return_picking.action_assign()
        return_picking.do_transfer()

        # Check the standard price of the product changed to 80.0 as we
        # returned the quants of purchase order 2
        self.assertEqual(self.product_fiforet_icecream.standard_price,
                         80.0, 'Standard price should have changed to 80.0! %s found instead' % (
                             self.product_fiforet_icecream.standard_price))
