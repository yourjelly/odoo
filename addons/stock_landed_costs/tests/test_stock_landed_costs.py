# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.stock_landed_costs.tests.common import TestStockLandedCostsCommon


class TestStockLandedCosts(TestStockLandedCostsCommon):

    def setUp(self):
        super(TestStockLandedCosts, self).setUp()
# In order to test the landed costs feature of stock, I create a landed cost, confirm it and check its account move created
# I create 2 products with different volume and gross weight and configure them for real_time valuation and real price costing method
        self.product_uom_unit = self.ref('product.product_uom_unit')
        self.product_product_2 = self.env.ref('product.product_product_2')

        self.o_expense = self.env['account.account'].create({
            'code': 'X1114',
            'name': 'Opening Expense - (test)',
            'user_type_id': self.env.ref("account.data_account_type_expenses").id
            })
        self.o_income = self.env['account.account'].create({
            'code': 'X1016',
            'name': 'Opening Income - (test)',
            'user_type_id': self.env.ref('account.data_account_type_other_income').id
            })

        self.product_landed_cost_1 = self.Product.create({
                'name': "LC product 1",
                'cost_method': 'real',
                'valuation': 'real_time',
                'weight': 10,
                'volume': 1,
                'property_stock_account_input': self.o_expense.id,
                'property_stock_account_output': self.o_income.id,
            })
        self.product_landed_cost_2 = self.Product.create({
                'name': "LC product 2",
                'cost_method': 'real',
                'valuation': 'real_time',
                'weight': 20,
                'volume': 1.5,
                'property_stock_account_input': self.o_expense.id,
                'property_stock_account_output': self.o_income.id,
            })

        # I create 2 picking moving those products

        self.picking_landed_cost_1 = self.Picking.create({
            'name': 'LC_pick_1',
            'picking_type_id': self.picking_type_out_id,
            'move_lines': [(0, 0, {
                'name': 'move 1',
                'product_id': self.product_landed_cost_1.id,
                'product_uom_qty': 5,
                'product_uom': self.product_uom_unit,
                'location_id': self.stock_location_id,
                'location_dest_id': self.customer_location_id,
                })],
            'location_id': self.stock_location_id,
            'location_dest_id': self.customer_location_id,
            })
        self.picking_landed_cost_2 = self.Picking.create({
            'name': 'LC_pick_2',
            'picking_type_id': self.picking_type_out_id,
            'move_lines': [(0, 0, {
                'name': 'move 2',
                'product_id': self.product_landed_cost_2.id,
                'product_uom_qty': 10,
                'product_uom': self.product_uom_unit,
                'location_id': self.stock_location_id,
                'location_dest_id': self.customer_location_id
                })],
            'location_id': self.stock_location_id,
            'location_dest_id': self.customer_location_id,
            })

        # I create a landed cost for those 2 pickings

        self.stock_landed_cost_1 = self.LandedCost.create({
            'picking_ids': [(6, 0, [self.picking_landed_cost_1.id, self.picking_landed_cost_2.id])],
            'account_journal_id': self.expenses_journal.id,
            'cost_lines': [
                (0, 0, {
                    'name': 'equal split',
                    'split_method': 'equal',
                    'price_unit': 10,
                    'product_id': self.product_product_2.id}),
                (0, 0, {
                    'name': 'split by quantity',
                    'split_method': 'by_quantity',
                    'price_unit': 150,
                    'product_id': self.product_product_2.id}),
                (0, 0, {
                    'name': 'split by weight',
                    'split_method': 'by_weight',
                    'price_unit': 250,
                    'product_id': self.product_product_2.id}),
                (0, 0, {
                    'name': 'split by volume',
                    'split_method': 'by_volume',
                    'price_unit': 20,
                    'product_id': self.product_product_2.id
                })],
            'valuation_adjustment_lines': []
        })

    def test_StockLandedCosts(self):

        # I compute the landed cost  using Compute button

        self.stock_landed_cost_1.compute_landed_cost()

        # I check the valuation adjustment lines
        for valuation in self.stock_landed_cost_1.valuation_adjustment_lines:
            if valuation.cost_line_id.name == 'equal split':
                self.assertEqual(valuation.additional_landed_cost, 5, "Value of additional_landed_cost is 5")
            elif valuation.cost_line_id.name == 'split by quantity' and valuation.move_id.name == "move 1":
                self.assertEqual(valuation.additional_landed_cost, 50, "Value of additional_landed_cost is 50")
            elif valuation.cost_line_id.name == 'split by quantity' and valuation.move_id.name == "move 2":
                self.assertEqual(valuation.additional_landed_cost, 100, "Value of additional_landed_cost is 100")
            elif valuation.cost_line_id.name == 'split by weight' and valuation.move_id.name == "move 1":
                self.assertEqual(valuation.additional_landed_cost, 50, "Value of additional_landed_cost is 50")
            elif valuation.cost_line_id.name == 'split by weight' and valuation.move_id.name == "move 2":
                self.assertEqual(valuation.additional_landed_cost, 200, "Value of additional_landed_cost is 200")
            elif valuation.cost_line_id.name == 'split by volume' and valuation.move_id.name == "move 1":
                self.assertEqual(valuation.additional_landed_cost, 5, "Value of additional_landed_cost is 5")
            elif valuation.cost_line_id.name == 'split by volume' and valuation.move_id.name == "move 2":
                self.assertEqual(valuation.additional_landed_cost, 15, "Value of additional_landed_cost is 15")
            else:
                raise 'unrecognized valuation adjustment line'

        # I confirm the landed cost

        self.stock_landed_cost_1.button_validate()
        # I check that the landed cost is now "Closed" and that it has an accounting entry

        self.assertEqual(self.stock_landed_cost_1.state, 'done', "Stock landed costs state is Done")
        self.assertTrue(self.stock_landed_cost_1.account_move_id, "account_move_id of Stock landed costs is not Initilized")
        self.assertEqual(len(self.stock_landed_cost_1.account_move_id.line_ids), 16, "Number of record in account_move_id of Stock landed costs is 16")
