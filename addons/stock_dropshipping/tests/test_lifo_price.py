from odoo.tests import common
import time
from odoo import tools
from odoo.modules.module import get_module_resource


class TestLifoPrice(common.TransactionCase):

    def _load(self, module, *args):
        tools.convert_file(
            self.cr, 'stock_dropshipping', get_module_resource(module, *args), {}, 'init', False, 'test', self.registry._assertion_report)

    def _create_purchase(self, product, product_qty=0.0, price_unit=0.0):
        return self.PurchaseOrder.create({
            'partner_id': self.partner_id,
            'order_line': [(0, 0, {
                'name': product.name,
                'product_id': product.id,
                'product_qty': product_qty,
                'product_uom': self.uom_id,
                'price_unit': price_unit,
                'date_planned': time.strftime('%Y-%m-%d'),
                'property_stock_account_input': self.ref('stock_dropshipping.o_expense'),
                'property_stock_account_output': self.ref('stock_dropshipping.o_income'),
                })]
            })

    def test_lifoprice(self):
        """ Test that create Product and Purchase order to test LIFO category of Product."""

        self._load('stock_account', 'test', 'stock_valuation_account.xml')

        # ======================================================================
        # FIRST PO FOR ICE-CREAM  :  10 kg * 60 Euro
        # SECOND PO FOR ICE-CREAM :  30 kg * 80 Euro
        # DELIVER 20 kg ICE-CREAM
        # IT WILL CONSUME ICE-CREAM OF ( 80 Euro price ) BASED ON REMOVAL STRETEGY ( LIFO ).
        # NOW PRODUCT PRICE SHOULD BE ( 80 Euro instead of 70 Euro )
        # ======================================================================

        # Set the company currency as EURO for the sake of repeatibility
        self.env.ref('base.main_company').write({'currency_id': self.ref('base.EUR')})

        # Set product category removal strategy as LIFO.
        self.product_category = self.ProductCategory.create({
            'name': 'Lifo Category',
            'removal_strategy_id': self.lifo_removal_strategy_id})

        # Set a product as using lifo price.
        self.icecream = self.Product.create({
            'default_code': 'LIFO',
            'name': 'LIFO Ice Cream',
            'type': 'product',
            'categ_id': self.product_category.id,
            'list_price': 100.0,
            'standard_price': 70.0,
            'uom_id': self.uom_kg_id,
            'uom_po_id': self.uom_kg_id,
            'valuation': 'real_time',
            'cost_method': 'real',
            })
        # I create a draft Purchase Order for first in move for 10 pieces at 60 euro.
        self.purchase_order1 = self._create_purchase(product=self.icecream, product_qty=10.0, price_unit=60.0)

        # I create a draft Purchase Order for Second in move for 30 pieces at 80 euro.
        self.purchase_order2 = self._create_purchase(product=self.icecream, product_qty=30.0, price_unit=80.0)

        # I confirm the first purchase order.
        self.purchase_order1.button_confirm()

        #  I check the 'Approved' status of first purchase order.
        self.assertEqual(self.purchase_order1.state, 'purchase', 'Wrong state of purchase order!')

        # Process the receipt of first purchase order.
        self.purchase_order1.picking_ids.do_transfer()

        # Check the standard price of the product (lifo icecream)
        self.assertEqual(self.icecream.standard_price, 70.0, 'Standard price should not have changed!')

        # I confirm the second purchase order.
        self.purchase_order2.button_confirm()

        # Process the receipt of second purchase order.
        self.purchase_order2.picking_ids[0].do_transfer()

        # Check the standard price should not have changed.
        self.assertEqual(self.icecream.standard_price, 70.0, 'Standard price should not have changed!')

        # Let us send some goods to customer.
        self.outgoing_shipment = self.Picking.create({
            'picking_type_id': self.pick_type_out_id,
            'location_id': self.stock_location_id,
            'location_dest_id': self.customer_location_id,
            'move_lines': [(0, 0, {
                'product_id': self.icecream.id,
                'product_uom': self.uom_kg_id,
                'product_uom_qty': 20.0,
                'location_id':  self.stock_location_id,
                'location_dest_id': self.customer_location_id,
                'picking_type_id': self.pick_type_out_id})]
            })

        # I assign this outgoing shipment.
        self.outgoing_shipment.action_assign()

        # Process the delivery of the outgoing shipment.
        self.outgoing_shipment.do_transfer()

        # Check standard price became 80 euro.
        self.assertEqual(self.icecream.standard_price, 80.0, 'Price should have been 80 euro')
