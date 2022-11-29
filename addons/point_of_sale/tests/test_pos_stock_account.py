# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import tools
import odoo
from odoo.addons.point_of_sale.tests.common import TestPoSCommon

@odoo.tests.tagged('post_install', '-at_install')
class TestPoSStock(TestPoSCommon):
    """ Tests for anglo saxon accounting scenario.
    """
    def setUp(self):
        super(TestPoSStock, self).setUp()

        self.config = self.basic_config
        self.product1 = self.create_product('Product 1', self.categ_anglo, 10.0, 5.0)
        self.product2 = self.create_product('Product 2', self.categ_anglo, 20.0, 10.0)
        self.product3 = self.create_product('Product 3', self.categ_basic, 30.0, 15.0)
        # start inventory with 10 items for each product
        self.adjust_inventory([self.product1, self.product2, self.product3], [10, 10, 10])

        # change cost(standard_price) of anglo products
        # then set inventory from 10 -> 15
        self.product1.write({'standard_price': 6.0})
        self.product2.write({'standard_price': 6.0})
        self.adjust_inventory([self.product1, self.product2, self.product3], [15, 15, 15])

        # change cost(standard_price) of anglo products
        # then set inventory from 15 -> 25
        self.product1.write({'standard_price': 13.0})
        self.product2.write({'standard_price': 13.0})
        self.adjust_inventory([self.product1, self.product2, self.product3], [25, 25, 25])

        self.output_account = self.categ_anglo.property_stock_account_output_categ_id
        self.expense_account = self.categ_anglo.property_account_expense_categ_id
        self.valuation_account = self.categ_anglo.property_stock_valuation_account_id

    def test_01_orders_no_invoiced(self):
        """

        Orders
        ======
        +---------+----------+-----+-------------+------------+
        | order   | product  | qty | total price | total cost |
        +---------+----------+-----+-------------+------------+
        | order 1 | product1 |  10 |       100.0 |       50.0 |  -> 10 items at cost of 5.0 is consumed, remains 5 items at 6.0 and 10 items at 13.0
        |         | product2 |  10 |       200.0 |      100.0 |  -> 10 items at cost of 10.0 is consumed, remains 5 items at 6.0 and 10 items at 13.0
        +---------+----------+-----+-------------+------------+
        | order 2 | product2 |   7 |       140.0 |       56.0 |  -> 5 items at cost of 6.0 and 2 items at cost of 13.0, remains 8 items at cost of 13.0
        |         | product3 |   7 |       210.0 |        0.0 |
        +---------+----------+-----+-------------+------------+
        | order 3 | product1 |   6 |        60.0 |       43.0 |  -> 5 items at cost of 6.0 and 1 item at cost of 13.0, remains 9 items at cost of 13.0
        |         | product2 |   6 |       120.0 |       78.0 |  -> 6 items at cost of 13.0, remains 2 items at cost of 13.0
        |         | product3 |   6 |       180.0 |        0.0 |
        +---------+----------+-----+-------------+------------+

        Expected Result
        ===============
        +---------------------+---------+
        | account             | balance |
        +---------------------+---------+
        | sale_account        | -1010.0 |
        | pos_receivable-cash |  1010.0 |
        | expense_account     |   327.0 |
        | output_account      |  -327.0 |
        +---------------------+---------+
        | Total balance       |    0.00 |
        +---------------------+---------+
        """

        def _before_closing_cb():
            # check values before closing the session
            self.assertEqual(3, self.pos_session.order_count)
            orders_total = sum(order.amount_total for order in self.pos_session.order_ids)
            self.assertAlmostEqual(orders_total, self.pos_session.total_payments_amount, msg='Total order amount should be equal to the total payment amount.')
            self.assertAlmostEqual(orders_total, 1010.0, msg='The orders\'s total amount should equal the computed.')

            # check product qty_available after syncing the order
            self.assertEqual(self.product1.qty_available, 9)
            self.assertEqual(self.product2.qty_available, 2)
            self.assertEqual(self.product3.qty_available, 12)

            # picking and stock moves should be in done state
            for order in self.pos_session.order_ids:
                self.assertEqual(order.picking_ids[0].state, 'done', 'Picking should be in done state.')
                self.assertTrue(all(state == 'done' for state in order.picking_ids[0].move_lines.mapped('state')), 'Move Lines should be in done state.')

        self._run_test({
            'payment_methods': self.cash_pm1 | self.bank_pm1,
            'orders': [
                {'pos_order_lines_ui_args': [(self.product1, 10), (self.product2, 10)], 'uid': '00100-010-0001'},
                {'pos_order_lines_ui_args': [(self.product2, 7), (self.product3, 7)], 'uid': '00100-010-0002'},
                {'pos_order_lines_ui_args': [(self.product1, 6), (self.product2, 6), (self.product3, 6)], 'uid': '00100-010-0003'},
            ],
            'before_closing_cb': _before_closing_cb,
            'journal_entries_before_closing': {},
            'journal_entries_after_closing': {
                'session_journal_entry': {
                    'line_ids': [
                        {'account_id': self.sales_account.id, 'partner_id': False, 'debit': 0, 'credit': 1010.0, 'reconciled': False},
                        {'account_id': self.expense_account.id, 'partner_id': False, 'debit': 327, 'credit': 0, 'reconciled': False},
                        {'account_id': self.cash_pm1.receivable_account_id.id, 'partner_id': False, 'debit': 1010.0, 'credit': 0, 'reconciled': True},
                        {'account_id': self.output_account.id, 'partner_id': False, 'debit': 0, 'credit': 327, 'reconciled': True},
                    ],
                },
                'cash_statement': [
                    ((1010.0, ), {
                        'line_ids': [
                            {'account_id': self.cash_pm1.journal_id.default_account_id.id, 'partner_id': False, 'debit': 1010.0, 'credit': 0, 'reconciled': False},
                            {'account_id': self.cash_pm1.receivable_account_id.id, 'partner_id': False, 'debit': 0, 'credit': 1010.0, 'reconciled': True},
                        ]
                    }),
                ],
                'bank_payments': [],
            },
        })

    def test_02_orders_with_invoice(self):
        """

        Orders
        ======
        Same with test_01 but order 3 is invoiced.

        Expected Result
        ===============
        +---------------------+---------+
        | account             | balance |
        +---------------------+---------+
        | sale_account        |  -650.0 |
        | pos_receivable-cash |  1010.0 |
        | receivable          |  -360.0 |
        | expense_account     |   206.0 |
        | output_account      |  -206.0 |
        +---------------------+---------+
        | Total balance       |    0.00 |
        +---------------------+---------+
        """

        def _before_closing_cb():
            # check values before closing the session
            self.assertEqual(3, self.pos_session.order_count)
            orders_total = sum(order.amount_total for order in self.pos_session.order_ids)
            self.assertAlmostEqual(orders_total, self.pos_session.total_payments_amount, msg='Total order amount should be equal to the total payment amount.')
            self.assertAlmostEqual(orders_total, 1010.0, msg='The orders\'s total amount should equal the computed.')

            # check product qty_available after syncing the order
            self.assertEqual(self.product1.qty_available, 9)
            self.assertEqual(self.product2.qty_available, 2)
            self.assertEqual(self.product3.qty_available, 12)

            # picking and stock moves should be in done state
            for order in self.pos_session.order_ids:
                self.assertEqual(order.picking_ids[0].state, 'done', 'Picking should be in done state.')
                self.assertTrue(all(state == 'done' for state in order.picking_ids[0].move_lines.mapped('state')), 'Move Lines should be in done state.')

        self._run_test({
            'payment_methods': self.cash_pm1 | self.bank_pm1,
            'orders': [
                {'pos_order_lines_ui_args': [(self.product1, 10), (self.product2, 10)], 'uid': '00100-010-0001'},
                {'pos_order_lines_ui_args': [(self.product2, 7), (self.product3, 7)], 'uid': '00100-010-0002'},
                {'pos_order_lines_ui_args': [(self.product1, 6), (self.product2, 6), (self.product3, 6)], 'is_invoiced': True, 'customer': self.customer, 'uid': '00100-010-0003'},
            ],
            'before_closing_cb': _before_closing_cb,
            'journal_entries_before_closing': {
                '00100-010-0003': {
                    'payments': [
                        ((self.cash_pm1, 360.0), {
                            'line_ids': [
                                {'account_id': self.c1_receivable.id, 'partner_id': self.customer.id, 'debit': 0, 'credit': 360.0, 'reconciled': True},
                                {'account_id': self.pos_receivable_account.id, 'partner_id': False, 'debit': 360.0, 'credit': 0, 'reconciled': False},
                            ]
                        }),
                    ],
                },
            },
            'journal_entries_after_closing': {
                'session_journal_entry': {
                    'line_ids': [
                        {'account_id': self.sales_account.id, 'partner_id': False, 'debit': 0, 'credit': 650, 'reconciled': False},
                        {'account_id': self.expense_account.id, 'partner_id': False, 'debit': 206, 'credit': 0, 'reconciled': False},
                        {'account_id': self.cash_pm1.receivable_account_id.id, 'partner_id': False, 'debit': 1010.0, 'credit': 0, 'reconciled': True},
                        {'account_id': self.pos_receivable_account.id, 'partner_id': False, 'debit': 0, 'credit': 360, 'reconciled': True},
                        {'account_id': self.output_account.id, 'partner_id': False, 'debit': 0, 'credit': 206, 'reconciled': True},
                    ],
                },
                'cash_statement': [
                    ((1010.0, ), {
                        'line_ids': [
                            {'account_id': self.cash_pm1.journal_id.default_account_id.id, 'partner_id': False, 'debit': 1010.0, 'credit': 0, 'reconciled': False},
                            {'account_id': self.cash_pm1.receivable_account_id.id, 'partner_id': False, 'debit': 0, 'credit': 1010.0, 'reconciled': True},
                        ]
                    }),
                ],
                'bank_payments': [],
            },
        })


    def test_03_order_product_w_owner(self):
        """
        Test order via POS a product having stock owner.
        """

        group_owner = self.env.ref('stock.group_tracking_owner')
        self.env.user.write({'groups_id': [(4, group_owner.id)]})
        self.product4 = self.create_product('Product 3', self.categ_basic, 30.0, 15.0)
        self.env['stock.quant'].with_context(inventory_mode=True).create({
            'product_id': self.product4.id,
            'inventory_quantity': 10,
            'location_id': self.stock_location_components.id,
            'owner_id': self.partner_a.id,
        }).action_apply_inventory()

        self.open_new_session()

        # create orders
        orders = []
        orders.append(self.create_ui_order_data([(self.product4, 1)]))

        # sync orders
        order = self.env['pos.order'].create_from_ui(orders)

        # check values before closing the session
        self.assertEqual(1, self.pos_session.order_count)

        # check product qty_available after syncing the order
        self.assertEqual(self.product4.qty_available, 9)

        # picking and stock moves should be in done state
        for order in self.pos_session.order_ids:
            self.assertEqual(order.picking_ids[0].state, 'done', 'Picking should be in done state.')
            self.assertTrue(all(state == 'done' for state in order.picking_ids[0].move_lines.mapped('state')), 'Move Lines should be in done state.')
            self.assertTrue(self.partner_a == order.picking_ids[0].move_lines[0].move_line_ids[0].owner_id, 'Move Lines Owner should be taken into account.')

        # close the session
        self.pos_session.action_pos_session_validate()


@odoo.tests.tagged('post_install', '-at_install')
class TestPoSFailedStockPicking(TestPoSCommon):
    """ Tests for anglo-saxon accounting when a stock picking fails when closing a POS session. These tests check that
    the COGS lines are corrected when the user fixes the failed stock picking afterwards.
    """
    def setUp(self):
        super(TestPoSFailedStockPicking, self).setUp()

        # Using the 'closing' setting because the main use case where the correction is needed is when you have multiple
        # orders in the session but one of them results in a failed stock picking, resulting in the inventory valuation
        # for the entire session amounting to 0 when the 'closing' method is used. If the 'real' method is used, the
        # impact is more limited.
        self.company_data['company'].write({
            'point_of_sale_update_stock_quantities': 'closing',
        })

        self.config = self.basic_config
        # Product 1 requires a serial number for tracking purposes
        self.product1 = self.create_product('Product 1', self.categ_anglo, 20.0, 10.0)
        self.product1.tracking = 'serial'
        # Product 2 doesn't have any tracking
        self.product2 = self.create_product('Product 2', self.categ_anglo, 30.0, 15.0)
        self.product2.tracking = 'none'
        # start inventory with 1 item for each product
        self.adjust_inventory([self.product1, self.product2], [1, 1])

        self.output_account = self.categ_anglo.property_stock_account_output_categ_id
        self.expense_account = self.categ_anglo.property_account_expense_categ_id
        self.valuation_account = self.categ_anglo.property_stock_valuation_account_id

    def test_selling_a_product_with_a_valid_picking(self):
        self.open_new_session()

        # create orders
        orders = [self.create_ui_order_data([(self.product2, 1)])]

        # sync orders
        self.env['pos.order'].create_from_ui(orders)

        # close the session
        self.pos_session.action_pos_session_validate()

        # picking should be in done state
        self.assertEqual(self.pos_session.picking_ids[0].state, 'done', 'Picking should be in done state.')

        self._assert_account_move(self.pos_session.move_id, {
            'line_ids': [
                {'account_id': self.sales_account.id, 'debit': 0, 'credit': 30, 'reconciled': False},
                {'account_id': self.expense_account.id, 'debit': 15, 'credit': 0, 'reconciled': False},
                {'account_id': self.cash_pm1.receivable_account_id.id, 'debit': 30, 'credit': 0, 'reconciled': True},
                {'account_id': self.output_account.id, 'debit': 0, 'credit': 15, 'reconciled': True},
            ],
        })

        # Verify the expected inventory valuation entry was created
        stock_picking_account_moves = self.pos_session.picking_ids[0].move_lines.account_move_ids
        self.assertEqual(len(stock_picking_account_moves), 1)
        self._assert_account_move(stock_picking_account_moves[0], {
            'line_ids': [
                {'account_id': self.valuation_account.id, 'debit': 0, 'credit': 15, 'reconciled': False},
                {'account_id': self.output_account.id, 'debit': 15, 'credit': 0, 'reconciled': True},
            ],
        })

    def test_selling_a_product_with_an_invalid_picking(self):
        self.open_new_session()

        # create orders
        orders = [self.create_ui_order_data([(self.product1, 1)])]

        # sync orders
        self.env['pos.order'].create_from_ui(orders)

        # close the session
        self.pos_session.action_pos_session_validate()

        # picking should be in confirmed state
        self.assertEqual(self.pos_session.picking_ids[0].state, 'confirmed', 'Picking should be in confirmed state.')

        # The expense and stock output lines will be 0 because the stock picking failed. The stock output line won't
        # be reconciled.
        self._assert_account_move(self.pos_session.move_id, {
            'line_ids': [
                {'account_id': self.sales_account.id, 'debit': 0, 'credit': 20, 'reconciled': False},
                {'account_id': self.expense_account.id, 'debit': 0, 'credit': 0, 'reconciled': False},
                {'account_id': self.cash_pm1.receivable_account_id.id, 'debit': 20, 'credit': 0, 'reconciled': True},
                {'account_id': self.output_account.id, 'debit': 0, 'credit': 0, 'reconciled': False},
            ],
        })

        # Set a serial number for the product
        lot = self.env['stock.production.lot'].create({
            'name': 'lot1',
            'product_id': self.product1.id,
            'company_id': self.env.company.id,
        })

        self.assertEqual(len(self.pos_session.picking_ids[0].move_line_ids), 1)
        self.pos_session.picking_ids[0].move_line_ids[0].write({
            'lot_id': lot.id
        })

        # Validate the stock picking
        self.pos_session.picking_ids[0].button_validate()

        # Verify the expected stock picking account moves were created
        stock_picking_account_moves = self.pos_session.picking_ids[0].move_lines.account_move_ids
        self.assertEqual(len(stock_picking_account_moves), 2)
        # Sort the moves in the order they were created in
        stock_picking_account_moves = sorted(stock_picking_account_moves, key=lambda x: x.name)

        # Verify the expected inventory valuation entry was created. The output account line will not be reconciled.
        self._assert_account_move(stock_picking_account_moves[0], {
            'line_ids': [
                {'account_id': self.valuation_account.id, 'debit': 0, 'credit': 10, 'reconciled': False},
                {'account_id': self.output_account.id, 'debit': 10, 'credit': 0, 'reconciled': False},
            ],
        })

        # Verify the additional COGS entry was created
        self._assert_account_move(stock_picking_account_moves[1], {
            'line_ids': [
                {'account_id': self.output_account.id, 'debit': 0, 'credit': 10, 'reconciled': False},
                {'account_id': self.expense_account.id, 'debit': 10, 'credit': 0, 'reconciled': False},
            ],
        })

    def test_selling_products_with_a_partially_invalid_picking(self):
        self.open_new_session()

        # create orders
        orders = [self.create_ui_order_data([(self.product1, 1), (self.product2, 1)])]

        # sync orders
        self.env['pos.order'].create_from_ui(orders)

        # close the session
        self.pos_session.action_pos_session_validate()

        # picking should be in assigned state
        self.assertEqual(self.pos_session.picking_ids[0].state, 'assigned', 'Picking should be in assigned state.')

        # The expense and stock output lines will be 0 because the stock picking failed. The stock output line won't
        # be reconciled.
        self._assert_account_move(self.pos_session.move_id, {
            'line_ids': [
                {'account_id': self.sales_account.id, 'debit': 0, 'credit': 50, 'reconciled': False},
                {'account_id': self.expense_account.id, 'debit': 0, 'credit': 0, 'reconciled': False},
                {'account_id': self.cash_pm1.receivable_account_id.id, 'debit': 50, 'credit': 0, 'reconciled': True},
                {'account_id': self.output_account.id, 'debit': 0, 'credit': 0, 'reconciled': False},
            ],
        })

        # Set a serial number for the product
        lot = self.env['stock.production.lot'].create({
            'name': 'lot1',
            'product_id': self.product1.id,
            'company_id': self.env.company.id,
        })

        self.assertEqual(len(self.pos_session.picking_ids[0].move_line_ids), 2)
        picking_move_lines = sorted(self.pos_session.picking_ids[0].move_line_ids, key=lambda x: x.product_id.name)
        picking_move_lines[0].write({
            'lot_id': lot.id
        })

        # Validate the stock picking
        self.pos_session.picking_ids[0].button_validate()

        # Verify the expected stock picking account moves were created
        stock_picking_account_moves = self.pos_session.picking_ids[0].move_lines.account_move_ids
        self.assertEqual(len(stock_picking_account_moves), 4)
        # Sort the moves in the order they were created in
        stock_picking_account_moves = sorted(stock_picking_account_moves, key=lambda x: x.name)

        # Verify the expected inventory valuation entry was created for product1. The output account line will not be
        # reconciled.
        self._assert_account_move(stock_picking_account_moves[0], {
            'line_ids': [
                {'account_id': self.valuation_account.id, 'debit': 0, 'credit': 10, 'reconciled': False},
                {'account_id': self.output_account.id, 'debit': 10, 'credit': 0, 'reconciled': False},
            ],
        })

        # Verify the additional COGS entry was created for product1.
        self._assert_account_move(stock_picking_account_moves[1], {
            'line_ids': [
                {'account_id': self.output_account.id, 'debit': 0, 'credit': 10, 'reconciled': False},
                {'account_id': self.expense_account.id, 'debit': 10, 'credit': 0, 'reconciled': False},
            ],
        })

        # Verify the expected inventory valuation entry was created for product2. The output account line will not be
        # reconciled.
        self._assert_account_move(stock_picking_account_moves[2], {
            'line_ids': [
                {'account_id': self.valuation_account.id, 'debit': 0, 'credit': 15, 'reconciled': False},
                {'account_id': self.output_account.id, 'debit': 15, 'credit': 0, 'reconciled': False},
            ],
        })

        # Verify the additional COGS entry was created for product2.
        self._assert_account_move(stock_picking_account_moves[3], {
            'line_ids': [
                {'account_id': self.output_account.id, 'debit': 0, 'credit': 15, 'reconciled': False},
                {'account_id': self.expense_account.id, 'debit': 15, 'credit': 0, 'reconciled': False},
            ],
        })

    def test_refunding_a_product_with_a_valid_picking(self):
        self.open_new_session()

        # create orders
        orders = [self.create_ui_order_data([(self.product2, -1)])]

        # sync orders
        self.env['pos.order'].create_from_ui(orders)

        # close the session
        self.pos_session.action_pos_session_validate()

        # picking should be in done state
        self.assertEqual(self.pos_session.picking_ids[0].state, 'done', 'Picking should be in done state.')

        self._assert_account_move(self.pos_session.move_id, {
            'line_ids': [
                {'account_id': self.sales_account.id, 'debit': 30, 'credit': 0, 'reconciled': False},
                {'account_id': self.expense_account.id, 'debit': 0, 'credit': 15, 'reconciled': False},
                {'account_id': self.cash_pm1.receivable_account_id.id, 'debit': 0, 'credit': 30, 'reconciled': True},
                {'account_id': self.output_account.id, 'debit': 15, 'credit': 0, 'reconciled': True},
            ],
        })

        # Verify the expected inventory valuation entry was created
        stock_picking_account_moves = self.pos_session.picking_ids[0].move_lines.account_move_ids
        self.assertEqual(len(stock_picking_account_moves), 1)
        self._assert_account_move(stock_picking_account_moves[0], {
            'line_ids': [
                {'account_id': self.output_account.id, 'debit': 0, 'credit': 15, 'reconciled': True},
                {'account_id': self.valuation_account.id, 'debit': 15, 'credit': 0, 'reconciled': False},
            ],
        })

    def test_refunding_a_product_with_an_invalid_picking(self):
        self.open_new_session()

        # create orders
        orders = [self.create_ui_order_data([(self.product1, -1)])]

        # sync orders
        self.env['pos.order'].create_from_ui(orders)

        # close the session
        self.pos_session.action_pos_session_validate()

        # picking should be in confirmed state
        self.assertEqual(self.pos_session.picking_ids[0].state, 'assigned', 'Picking should be in assigned state.')

        # The expense and stock output lines will be 0 because the stock picking failed. The stock output line won't
        # be reconciled.
        self._assert_account_move(self.pos_session.move_id, {
            'line_ids': [
                {'account_id': self.sales_account.id, 'debit': 20, 'credit': 0, 'reconciled': False},
                {'account_id': self.expense_account.id, 'debit': 0, 'credit': 0, 'reconciled': False},
                {'account_id': self.cash_pm1.receivable_account_id.id, 'debit': 0, 'credit': 20, 'reconciled': True},
                {'account_id': self.output_account.id, 'debit': 0, 'credit': 0, 'reconciled': False},
            ],
        })

        # Set a serial number for the product
        lot = self.env['stock.production.lot'].create({
            'name': 'lot1',
            'product_id': self.product1.id,
            'company_id': self.env.company.id,
        })

        # Odoo will create 2 move lines: a first with reserved qty 1 and done qty 0, and a second with reserved qty 0
        # and done qty 1. Delete the second line. Set the done qty to 1 on the first line, which is what also happens
        # in the UI if you assign a serial number.
        self.assertEqual(len(self.pos_session.picking_ids[0].move_line_ids), 2)
        self.pos_session.picking_ids[0].move_line_ids[0].write({
            'lot_id': lot.id,
            'qty_done': 1,
        })
        self.pos_session.picking_ids[0].move_line_ids[1].unlink()

        # Validate the stock picking
        self.pos_session.picking_ids[0].button_validate()

        # Verify the expected stock picking account moves were created
        stock_picking_account_moves = self.pos_session.picking_ids[0].move_lines.account_move_ids
        self.assertEqual(len(stock_picking_account_moves), 2)
        # Sort the moves in the order they were created in
        stock_picking_account_moves = sorted(stock_picking_account_moves, key=lambda x: x.name)

        # Verify the expected inventory valuation entry was created. The output account line will not be reconciled.
        self._assert_account_move(stock_picking_account_moves[0], {
            'line_ids': [
                {'account_id': self.output_account.id, 'debit': 0, 'credit': 10, 'reconciled': False},
                {'account_id': self.valuation_account.id, 'debit': 10, 'credit': 0, 'reconciled': False},
            ],
        })

        # Verify the additional COGS entry was created
        self._assert_account_move(stock_picking_account_moves[1], {
            'line_ids': [
                {'account_id': self.expense_account.id, 'debit': 0, 'credit': 10, 'reconciled': False},
                {'account_id': self.output_account.id, 'debit': 10, 'credit': 0, 'reconciled': False},
            ],
        })
