# -*- coding: utf-8 -*-

from odoo.addons.account.tests.account_test_classes import AccountingTestCase

class TestStockLandedCostsCommon(AccountingTestCase):
    # I create 2 products with different cost prices and configure them for real_time valuation and real price costing method
    def _create_product(self, pro_name):
        return self.Product.create({
            'name': pro_name,
            'cost_method': 'real',
            'uom_id': self.product_uom_unit_round_1.id,
            'valuation': 'real_time',
            'property_stock_account_input': self.default_o_expense,
            'property_stock_account_output': self.default_o_income
        })
    # I create 2 pickings moving those products
    def _create_picking(self, pick_name, ml_name, pid, p_qty, p_unit, p_uom):
        return self.Picking.create({
            'name': pick_name,
            'picking_type_id': self.picking_type_in_id,
            'location_id': self.customer_location_id,
            'location_dest_id': self.stock_location_id,
            'move_lines': [(0, 0,{
                            'name': ml_name,
                            'product_id': pid,
                            'product_uom_qty': p_qty,
                            'price_unit': p_unit,
                            'product_uom': p_uom,
                            'location_id': self.customer_location_id,
                            'location_dest_id': self.stock_location_id})]})
   
    def setUp(self):
        super(TestStockLandedCostsCommon, self).setUp()
        # Objects
        self.Product = self.env['product.product']
        self.Picking = self.env['stock.picking']
        self.Move = self.env['stock.move']
        self.LandedCost = self.env['stock.landed.cost']
        self.CostLine = self.env['stock.landed.cost.lines']
        # References
        self.supplier_id = self.ref('base.res_partner_2')
        self.customer_id = self.ref('base.res_partner_4')
        self.picking_type_in_id = self.ref('stock.picking_type_in')
        self.picking_type_out_id = self.ref('stock.picking_type_out')
        self.supplier_location_id = self.ref('stock.stock_location_suppliers')
        self.stock_location_id = self.ref('stock.stock_location_stock')
        self.customer_location_id = self.ref('stock.stock_location_customers')
        self.categ_all = self.env.ref('product.product_category_all')
        # Create account
        self.default_account = self.env['account.account'].create({
            'name': "Purchased Stocks",
            'code': "X1101",
            'user_type_id': self.env['account.account.type'].create({
                    'name': 'Expenses',
                    'type': 'other'}).id,
            'reconcile': True})
        self.expenses_journal = self.env['account.journal'].create({
            'name': 'Expenses - Test',
            'code': 'TEXJ',
            'type': 'purchase',
            'default_debit_account_id': self.default_account.id,
            'default_credit_account_id': self.default_account.id})
        # Create product refrigerator & oven
        self.product_refrigerator = self.Product.create({
            'name': 'Refrigerator',
            'type': 'product',
            'cost_method': 'real',
            'valuation': 'real_time',
            'standard_price': 1.0,
            'weight': 10,
            'volume': 1,
            'categ_id': self.categ_all.id})
        self.product_oven = self.Product.create({
            'name': 'Microwave Oven',
            'type': 'product',
            'cost_method': 'real',
            'valuation': 'real_time',
            'standard_price': 1.0,
            'weight': 20,
            'volume': 1.5,
            'categ_id': self.categ_all.id})
        #property stock account output
        self.default_o_income = self.env['account.account'].create({
            'code': "X1012",
            'name': "Opening Income",
            'user_type_id': self.env['account.account.type'].create({
                    'name': 'Other Income',
                    'type': 'other'}).id})
        #property stock account input
        self.default_o_expense = self.env['account.account'].create({
            'code': "X1112",
            'name': "Opening Expense",
            'user_type_id': self.env['account.account.type'].create({
                    'name': 'Expenses',
                    'type': 'other'}).id})
        # Create service type product 1.Labour 2.Brokerage 3.Transportation 4.Packaging
        self.landed_cost = self._create_services('Landed Cost')
        self.brokerage_quantity = self._create_services('Brokerage Cost')
        self.transportation_weight = self._create_services('Transportation Cost')
        self.packaging_volume = self._create_services('Packaging Cost')

    def _create_services(self, name):
        return self.Product.create({
            'name': name,
            'landed_cost_ok': True,
            'type': 'service'})

    def _error_message(self, actucal_cost, computed_cost):
        return 'Additional Landed Cost should be %s instead of %s' % (actucal_cost, computed_cost)
