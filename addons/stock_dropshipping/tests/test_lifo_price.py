from odoo.tests import common
import time
from odoo import tools
from odoo.modules.module import get_module_resource


class TestLifoPrice(common.TransactionCase):

    def _load(self, module, *args):
        tools.convert_file(
            self.cr, 'stock_dropshipping',
            get_module_resource(module, *args), {}, 'init', False, 'test', self.registry._assertion_report)

    def _create_purchase(self, product, product_qty=0.0, price_unit=0.0):
        return self.PurchaseOrder.create({
            'partner_id': self.partner_id,
            'order_line': [(0, 0, {
                'name': product.name,
                'product_id': product.id,
                'product_qty': product_qty,
                'product_uom': self.uom_id,
                'price_unit': price_unit,
                'date_planned': time.strftime('%Y-%m-%d')
                })]
            })

    def setUp(self):
        super(TestLifoPrice, self).setUp()
        self.ResCompany = self.env['res.company']
        self.Product = self.env['product.product']
        self.ProductCategory = self.env['product.category']
        self.PurchaseOrder = self.env['purchase.order']
        self.Picking = self.env['stock.picking']
        self.Move = self.env['stock.move']
        # Create Accounts
        self.Account = self.env['account.account']
        # ref id
        self.removal_strategy_id = self.ref('stock.removal_lifo')
        self.uom_id = self.ref('product.product_uom_kgm')
        self.partner_id = self.ref('base.res_partner_3')
        self.pick_type_id = self.ref('stock.picking_type_out')
        self.location_id = self.env.ref('stock.stock_location_stock').id
        self.location_dest_id= self.env.ref('stock.stock_location_customers').id
        self.default_o_income = self.Account.create({
            'code': 'X1012',
            'name': 'Opening Income',
            'user_type_id': self.env.ref('account.data_account_type_other_income').id,
            'reconcile': True})

        self.default_o_expense = self.Account.create({
            'code': 'X1112',
            'name': 'Opening Expense',
            'user_type_id': self.env.ref('account.data_account_type_expenses').id
            })

    def test_lifoprice(self):
        self._load('account', 'test', 'account_minimal_test.xml')
        self._load('stock_account', 'test', 'stock_valuation_account.xml')
        """ Test that create Product and Purchase order to test LIFO category of Product."""

        # Set the company currency as EURO for the sake of repeatibility
        self.ResCompany.write({'currency_id': self.ref('base.EUR')})

        # Set product category removal strategy as LIFO.
        self.product_category = self.ProductCategory.create({
            'name': 'Lifo Category',
            'removal_strategy_id': self.removal_strategy_id})

        # Set a product as using lifo price.
        self.product_lifo_icecream = self.Product.create({
            'default_code': 'LIFO',
            'name': 'LIFO Ice Cream',
            'type': 'product',
            'categ_id': self.product_category.id,
            'list_price': 100.0,
            'standard_price': 70.0,
            'uom_id': self.uom_id,
            'uom_po_id': self.uom_id,
            'valuation': 'real_time',
            'cost_method': 'real',
            'property_stock_account_input': self.default_o_expense.id,
            'property_stock_account_output': self.default_o_income.id,
            'description': 'LIFO Ice Cream can be mass-produced and thus is widely available in developed parts of the world. Ice cream can be purchased in large cartons (vats and squrounds) from supermarkets and grocery stores, in smaller quantities from ice cream shops, convenience stores, and milk bars, and in individual servings from small carts or vans at public events.'
            })
        # I create a draft Purchase Order for first in move for 10 pieces at 60 euro.
        self.purchase_order_lifo1 = self._create_purchase(product=self.product_lifo_icecream, product_qty=10.0, price_unit=60.0)

        # I create a draft Purchase Order for Second in move for 30 pieces at 80 euro.
        self.purchase_order_lifo2 = self._create_purchase(product=self.product_lifo_icecream, product_qty=30.0, price_unit=80.0)

        # I confirm the first purchase order.
        self.purchase_order_lifo1.button_confirm()

        #  I check the 'Approved' status of first purchase order.
        self.assertEqual(self.purchase_order_lifo1.state, 'purchase', 'Wrong state of purchase order!')

        # Process the receipt of first purchase order.
        self.purchase_order_lifo1.picking_ids.do_transfer()

        # Check the standard price of the product (lifo icecream)
        self.assertEqual(self.product_lifo_icecream.standard_price, 70.0, 'Standard price should not have changed!')

        # I confirm the second purchase order.
        self.purchase_order_lifo2.button_confirm()

        # Process the receipt of second purchase order.
        self.purchase_order_lifo2.picking_ids[0].do_transfer()

        # Check the standard price should not have changed.
        self.assertEqual(self.product_lifo_icecream.standard_price, 70.0, 'Standard price should not have changed!')

        # Let us send some goods.
        self.outgoing_lifo_shipment = self.Picking.create({
            'picking_type_id': self.pick_type_id,
            'location_id': self.location_id,
            'location_dest_id': self.location_dest_id})

        # Picking needs movement from stock.
        self.outgoing_shipment_lifo_icecream = self.Move.create({
            'name': 'a move',
            'picking_id': self.outgoing_lifo_shipment.id,
            'product_id': self.product_lifo_icecream.id,
            'product_uom': self.uom_id,
            'location_id':  self.location_id,
            'location_dest_id': self.location_dest_id,
            'product_uom_qty': 20.0,
            'picking_type_id': self.pick_type_id})

        # I assign this outgoing shipment.
        self.outgoing_lifo_shipment.action_assign()

        # Process the delivery of the outgoing shipment.
        self.outgoing_lifo_shipment.do_transfer()

        # Check standard price became 80 euro.
        self.assertEqual(self.product_lifo_icecream.standard_price, 80.0, 'Price should have been 80 euro')
