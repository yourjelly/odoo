from odoo import Command
from odoo.addons.point_of_sale.tests.test_frontend import TestPointOfSaleHttpCommon
from odoo.tests import tagged


@tagged('post_install', '-at_install')
class TestPosCashRounding(TestPointOfSaleHttpCommon):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.cash_rounding_add_invoice_line = cls.env['account.cash.rounding'].create({
            'name': "cash_rounding_add_invoice_line",
            'rounding': 0.05,
            'rounding_method': 'HALF-UP',
            'strategy': 'add_invoice_line',
            'profit_account_id': cls.env.company.default_cash_difference_income_account_id.id,
            'loss_account_id': cls.env.company.default_cash_difference_expense_account_id.id,
        })
        cls.cash_rounding_biggest_tax = cls.env['account.cash.rounding'].create({
            'name': "cash_rounding_biggest_tax",
            'rounding': 0.05,
            'rounding_method': 'HALF-UP',
            'strategy': 'biggest_tax',
            'profit_account_id': cls.env.company.default_cash_difference_income_account_id.id,
            'loss_account_id': cls.env.company.default_cash_difference_expense_account_id.id,
        })

        cls.product = cls.env['product.product'].create({
            'name': "random_product",
            'available_in_pos': True,
            'list_price': 13.67,
            'taxes_id': [Command.set(cls.company_data['default_tax_sale'].ids)],
            'pos_categ_ids': [Command.set(cls.pos_desk_misc_test.ids)],
        })

    def test_cash_rounding_add_invoice_line_not_only_round_cash_method(self):
        self.main_pos_config.write({
            'rounding_method': self.cash_rounding_add_invoice_line.id,
            'cash_rounding': True,
            'only_round_cash_method': False,
        })
        with self.with_new_session(user=self.pos_user) as session:
            self.start_pos_tour('test_cash_rounding_add_invoice_line_not_only_round_cash_method')
            order2, order1 = self.env['pos.order'].search([('session_id', '=', session.id)], limit=2)
            self.assertRecordValues(order1, [{
                'amount_tax': 2.05,
                'amount_total': 15.7,
                'amount_paid': 15.7,
            }])
            self.assertRecordValues(order1.account_move, [{
                'amount_untaxed': 13.65,
                'amount_tax': 2.05,
                'amount_total': 15.7,
            }])
            self.assertRecordValues(order2, [{
                'amount_tax': 2.05,
                'amount_total': 15.70,
                'amount_paid': 15.72,
            }])
            self.assertRecordValues(order2.account_move, [{
                'amount_untaxed': 13.67,
                'amount_tax': 2.05,
                'amount_total': 15.72,
            }])

    def test_cash_rounding_add_invoice_line_only_round_cash_method(self):
        self.main_pos_config.write({
            'rounding_method': self.cash_rounding_add_invoice_line.id,
            'cash_rounding': True,
            'only_round_cash_method': True,
        })
        with self.with_new_session(user=self.pos_user) as session:
            self.start_pos_tour('test_cash_rounding_add_invoice_line_only_round_cash_method')
            order2, order1 = self.env['pos.order'].search([('session_id', '=', session.id)], limit=2)
            self.assertRecordValues(order1, [{
                'amount_tax': 2.05,
                'amount_total': 15.719999999999999,
                'amount_paid': 15.7,
            }])
            self.assertRecordValues(order1.account_move, [{
                'amount_untaxed': 13.65,
                'amount_tax': 2.05,
                'amount_total': 15.7,
            }])
            self.assertRecordValues(order2, [{
                'amount_tax': 2.05,
                'amount_total': 15.719999999999999,
                'amount_paid': 15.73,
            }])
            self.assertRecordValues(order2.account_move, [{
                'amount_untaxed': 13.68,
                'amount_tax': 2.05,
                'amount_total': 15.73,
            }])

    def test_cash_rounding_biggest_tax_not_only_round_cash_method(self):
        self.main_pos_config.write({
            'rounding_method': self.cash_rounding_biggest_tax.id,
            'cash_rounding': True,
            'only_round_cash_method': False,
        })
        with self.with_new_session(user=self.pos_user) as session:
            self.start_pos_tour('test_cash_rounding_biggest_tax_not_only_round_cash_method')
            order2, order1 = self.env['pos.order'].search([('session_id', '=', session.id)], limit=2)
            self.assertRecordValues(order1, [{
                'amount_tax': 2.0300000000000002,
                'amount_total': 15.7,
                'amount_paid': 15.7,
            }])
            self.assertRecordValues(order1.account_move, [{
                'amount_untaxed': 13.67,
                'amount_tax': 2.03,
                'amount_total': 15.7,
            }])
            self.assertRecordValues(order2, [{
                'amount_tax': 2.0300000000000002,
                'amount_total': 15.70,
                'amount_paid': 15.72,
            }])
            self.assertRecordValues(order2.account_move, [{
                'amount_untaxed': 13.69,
                'amount_tax': 2.03,
                'amount_total': 15.72,
            }])

    def test_cash_rounding_biggest_tax_only_round_cash_method(self):
        self.main_pos_config.write({
            'rounding_method': self.cash_rounding_biggest_tax.id,
            'cash_rounding': True,
            'only_round_cash_method': True,
        })
        with self.with_new_session(user=self.pos_user) as session:
            self.start_pos_tour('test_cash_rounding_biggest_tax_only_round_cash_method')
            order2, order1 = self.env['pos.order'].search([('session_id', '=', session.id)], limit=2)
            self.assertRecordValues(order1, [{
                'amount_tax': 2.05,
                'amount_total': 15.719999999999999,
                'amount_paid': 15.7,
            }])
            self.assertRecordValues(order1.account_move, [{
                'amount_untaxed': 13.67,
                'amount_tax': 2.03,
                'amount_total': 15.7,
            }])
            self.assertRecordValues(order2, [{
                'amount_tax': 2.05,
                'amount_total': 15.719999999999999,
                'amount_paid': 15.73,
            }])
            self.assertRecordValues(order2.account_move, [{
                'amount_untaxed': 13.70,
                'amount_tax': 2.03,
                'amount_total': 15.73,
            }])
