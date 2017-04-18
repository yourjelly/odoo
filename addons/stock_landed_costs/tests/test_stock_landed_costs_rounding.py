# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo.addons.stock_landed_costs.tests.common import TestStockLandedCostsCommon

class TestLandedCostsRounding(TestStockLandedCostsCommon):
    ''' In order to test the rounding in landed costs feature of stock, I create 2 landed cost'''

    def setUp(self):
        super(TestLandedCostsRounding, self).setUp()
        self.ProductUom = self.env['product.uom']
        self.product_uom_categ_unit = self.ref('product.product_uom_categ_unit')
        self.uom_dozen_id = self.ref('product.product_uom_dozen')
        # Define undivisible units
        self.product_uom_unit_round_1 = self.ProductUom.create({
            'category_id': self.product_uom_categ_unit,
            'name': "Uom Unit",
            'factor': 1.0,
            'rounding': 1.0})
    
    def test_00_picking(self):
            # We perform all the tests for LC_pick_3
            # I receive picking LC_pick_3, and check how many quants are created
            p1 = self._create_picking("LC_pick_3","move 3",self._create_product("LC product 3").id, 13, 1.0, self.product_uom_unit_round_1.id)
            p1.move_lines.price_unit = 1.0
            p1.action_confirm()
            p1.action_assign()
            p1.action_done()
            quants = p1.move_lines.quant_ids
            self.assertEqual(len(quants), 1, 'not equal length')
            self.assertEqual((quants.qty), 13, 'not equal qty')
            self.assertEqual((quants.cost), 1.0, 'not equal cost')
            self.stock_landed_cost_2 = self._create_landed_costs_1({'equal_price_unit': 15}, p1)
            # Compute landed costs
            self.stock_landed_cost_2.compute_landed_cost()
            valid_vals = {'equal': 15.0}
            # Check valuation adjustment line recognized or not
            self._validate_additional_landed_cost_lines_1(self.stock_landed_cost_2, valid_vals)
            # I confirm the landed cost
            self.stock_landed_cost_2.button_validate()
            # I check that the landed cost is now "Closed" and that it has an accounting entry
            self.assertEqual(self.stock_landed_cost_2.state, 'done', 'stock_landed_cost_2 should be in done state')
            self.assertTrue(self.stock_landed_cost_2.account_move_id, 'Landed costs should be available account move lines')
            # I check the quants quantity and cost
            for valuation in self.stock_landed_cost_2.valuation_adjustment_lines:
                quants = valuation.move_id.quant_ids
                self.assertEqual(quants.mapped('qty'), [12.0, 1.0], 'not equal qty') 
                self.assertEqual(quants.mapped('cost'), [2.15, 2.2], 'not equal cost')

    def test_01_picking(self):
        # We perform all the tests for LC_pick_4
        # I receive picking LC_pick_4, and check how many quants are created
        p2 = self._create_picking("LC_pick_4","move 4", self._create_product("LC product 4").id, 1, 17.00 / 12.00, self.uom_dozen_id)
        p2.move_lines.price_unit = 17.0 / 12.0
        p2.action_confirm()
        p2.action_assign()
        p2.action_done()
        quants = p2.move_lines.quant_ids
        self.assertEqual(len(quants), 2, 'not equal length')
        self.assertEqual(quants.mapped('qty'), [11.0, 1.0], 'not equal qty') 
        self.assertEqual([round(c, 2) for c in quants.mapped('cost')], [1.42, 1.38], 'not equal cost')
        self.stock_landed_cost_2 = self._create_landed_costs_1({'equal_price_unit': 11}, p2)
        # Compute landed costs
        self.stock_landed_cost_2.compute_landed_cost()
        valid_vals = {'equal': 11.0}
        # # Check valuation adjustment line recognized or not
        self._validate_additional_landed_cost_lines_1(self.stock_landed_cost_2, valid_vals)
        # I confirm the landed cost
        self.stock_landed_cost_2.button_validate()
        # I check that the landed cost is now "Closed" and that it has an accounting entry
        self.assertEqual(self.stock_landed_cost_2.state, 'done', 'stock_landed_cost_2 should be in done state')
        self.assertTrue(self.stock_landed_cost_2.account_move_id, 'Landed costs should be available account move lines')
        # I check the quants quantity and cost
        for valuation in self.stock_landed_cost_2.valuation_adjustment_lines:
            quants = valuation.move_id.quant_ids
            self.assertEqual(quants.mapped('qty'), [11.0, 1.0], 'not equal qty') 
            self.assertEqual([round(c, 2) for c in quants.mapped('cost')], [2.34, 2.26], 'not equal cost') 
    
    # I create a landed cost for picking 3 and picking 4
    def _create_landed_costs_1(self, value, p1):
        return self.LandedCost.create(dict(
            picking_ids = [(6, 0, [p1.id])],
            account_journal_id = self.expenses_journal.id,
            cost_lines=[(0, 0, {
                    'name': 'equal split',
                    'split_method': 'equal',
                    'price_unit': value['equal_price_unit'],
                    'product_id': self.landed_cost.id})]))

    def _validate_additional_landed_cost_lines_1(self, stock_landed_cost_2, valid_vals):
        for valuation in self.stock_landed_cost_2.valuation_adjustment_lines:
            add_cost = valuation.additional_landed_cost
            split_method = valuation.cost_line_id.split_method
            product = valuation.move_id.product_id
            if split_method == 'equal':
                self.assertEqual(add_cost, valid_vals['equal'], self._error_message(valid_vals['equal'], add_cost))
    