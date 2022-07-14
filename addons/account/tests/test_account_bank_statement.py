# -*- coding: utf-8 -*-
from odoo.addons.account.tests.common import AccountTestInvoicingCommon
from odoo.tests import tagged
from odoo.tests.common import Form
from odoo.exceptions import ValidationError, UserError
from odoo import fields, Command


@tagged('post_install', '-at_install')
class TestAccountBankStatementLine(AccountTestInvoicingCommon):

    @classmethod
    def setUpClass(cls, chart_template_ref=None):
        super().setUpClass(chart_template_ref=chart_template_ref)

        # We need a third currency as you could have a company's currency != journal's currency !=
        cls.currency_data_2 = cls.setup_multi_currency_data(default_values={
            'name': 'Dark Chocolate Coin',
            'symbol': '🍫',
            'currency_unit_label': 'Dark Choco',
            'currency_subunit_label': 'Dark Cacao Powder',
        }, rate2016=6.0, rate2017=4.0)
        cls.currency_data_3 = cls.setup_multi_currency_data(default_values={
            'name': 'Black Chocolate Coin',
            'symbol': '🍫',
            'currency_unit_label': 'Black Choco',
            'currency_subunit_label': 'Black Cacao Powder',
        }, rate2016=12.0, rate2017=8.0)

        cls.bank_journal_1 = cls.company_data['default_journal_bank']
        cls.bank_journal_2 = cls.bank_journal_1.copy()
        cls.bank_journal_3 = cls.bank_journal_2.copy()
        cls.currency_1 = cls.company_data['currency']
        cls.currency_2 = cls.currency_data['currency']
        cls.currency_3 = cls.currency_data_2['currency']
        cls.currency_4 = cls.currency_data_3['currency']

        cls.statement = cls.env['account.bank.statement'].create({
            'name': 'test_statement',
            'line_ids': [
                (0, 0, {
                    'date': '2019-01-01',
                    'payment_ref': 'line_1',
                    'partner_id': cls.partner_a.id,
                    'foreign_currency_id': cls.currency_2.id,
                    'journal_id': cls.bank_journal_1.id,
                    'amount': 1250.0,
                    'amount_currency': 2500.0,
                }),
            ],
        })
        cls.statement_line = cls.statement.line_ids

        cls.expected_st_line = {
            'date': fields.Date.from_string('2019-01-01'),
            'journal_id': cls.statement.journal_id.id,
            'payment_ref': 'line_1',
            'partner_id': cls.partner_a.id,
            'currency_id': cls.currency_1.id,
            'foreign_currency_id': cls.currency_2.id,
            'amount': 1250.0,
            'amount_currency': 2500.0,
            'is_reconciled': False,
        }

        cls.expected_bank_line = {
            'name': cls.statement_line.payment_ref,
            'partner_id': cls.statement_line.partner_id.id,
            'currency_id': cls.currency_1.id,
            'account_id': cls.statement.journal_id.default_account_id.id,
            'debit': 1250.0,
            'credit': 0.0,
            'amount_currency': 1250.0,
        }

        cls.expected_counterpart_line = {
            'name': cls.statement_line.payment_ref,
            'partner_id': cls.statement_line.partner_id.id,
            'currency_id': cls.currency_2.id,
            'account_id': cls.statement.journal_id.suspense_account_id.id,
            'debit': 0.0,
            'credit': 1250.0,
            'amount_currency': -2500.0,
        }

        cls.st_lines = cls.env['account.bank.statement.line'].create(
            [
                {
                    'company_id': cls.company_data_2['company'].id,
                    'journal_id': cls.company_data_2['default_journal_bank'].id,
                    'payment_ref': f'line_{vals[0]}',
                    'amount': vals[0],
                    'date': fields.Date.from_string(vals[1]),
                } for vals in [
                    (1, '2020-01-10'),
                    (6, '2020-01-13'),
                    (2, '2020-01-11'),
                    (3, '2020-01-12'),
                    (4, '2020-01-12'),
                    (7, '2020-01-13'),
                    (5, '2020-01-12'),
                ]
            ]
        ).sorted()

    def assertBankStatementLine(self, statement_line, expected_statement_line_vals, expected_move_line_vals):
        self.assertRecordValues(statement_line, [expected_statement_line_vals])
        self.assertRecordValues(statement_line.line_ids.sorted('balance'), expected_move_line_vals)

    def create_bank_transaction(self, amount, date, amount_currency=None, currency=None, statement=None,
                                partner=None, journal=None, sequence=0):
        values = {
            'payment_ref': str(amount),
            'amount': amount,
            'date': date,
            'partner_id': partner and partner.id,
            'sequence': sequence,
        }
        if amount_currency:
            values['amount_currency'] = amount_currency
            values['foreign_currency_id'] = currency.id
        if statement and journal and statement.journal_id != journal:
            raise(ValidationError("The statement and the journal are contradictory"))
        if statement:
            values['journal_id'] = statement.journal_id.id
            values['statement_id'] = statement.id
        if journal:
            values['journal_id'] = journal.id
        if not values.get('journal_id'):
            values['journal_id'] = (self.company_data_2['default_journal_bank']
                                    if self.env.company == self.company_data_2['company']
                                    else self.company_data['default_journal_bank']
                                    ).id
        return self.env['account.bank.statement.line'].create(values)
    # -------------------------------------------------------------------------
    # TESTS about the statement line model.
    # -------------------------------------------------------------------------

    def _test_statement_line_edition(
            self,
            journal,
            amount, amount_currency,
            journal_currency, foreign_currency,
            expected_liquidity_values, expected_counterpart_values):
        ''' Test the edition of a statement line from itself or from its linked journal entry.
        :param journal:                     The account.journal record that will be set on the statement line.
        :param amount:                      The amount in journal's currency.
        :param amount_currency:             The amount in the foreign currency.
        :param journal_currency:            The journal's currency as a res.currency record.
        :param foreign_currency:            The foreign currency as a res.currency record.
        :param expected_liquidity_values:   The expected account.move.line values for the liquidity line.
        :param expected_counterpart_values: The expected account.move.line values for the counterpart line.
        '''
        if journal_currency:
            journal.currency_id = journal_currency.id

        statement_line = self.env['account.bank.statement.line'].create({
            'date': '2019-01-01',
            'journal_id': journal.id,
            'payment_ref': 'line_1',
            'partner_id': self.partner_a.id,
            'foreign_currency_id': foreign_currency and foreign_currency.id,
            'amount': amount,
            'amount_currency': amount_currency,
        })

        # ==== Test the statement line amounts are correct ====
        # If there is a bug in the compute/inverse methods, the amount/amount_currency could be
        # incorrect directly after the creation of the statement line.

        self.assertRecordValues(statement_line, [{
            'amount': amount,
            'amount_currency': amount_currency,
        }])
        self.assertRecordValues(statement_line.move_id, [{
            'partner_id': self.partner_a.id,
            'currency_id': (statement_line.foreign_currency_id or statement_line.currency_id).id,
        }])

        # ==== Test the edition of statement line amounts ====
        # The statement line must remain consistent with its account.move.
        # To test the compute/inverse methods are correctly managing all currency setup,
        # we check the edition of amounts in both directions statement line <-> journal entry.

        # Check initial state of the statement line.
        liquidity_lines, suspense_lines, other_lines = statement_line._seek_for_lines()
        self.assertRecordValues(liquidity_lines, [expected_liquidity_values])
        self.assertRecordValues(suspense_lines, [expected_counterpart_values])

        # Check the account.move is still correct after editing the account.bank.statement.line.
        statement_line.write({
            'amount': statement_line.amount * 2,
            'amount_currency': statement_line.amount_currency * 2,
        })
        self.assertRecordValues(statement_line, [{
            'amount': amount * 2,
            'amount_currency': amount_currency * 2,
        }])
        self.assertRecordValues(liquidity_lines, [{
            **expected_liquidity_values,
            'debit': expected_liquidity_values.get('debit', 0.0) * 2,
            'credit': expected_liquidity_values.get('credit', 0.0) * 2,
            'amount_currency': expected_liquidity_values.get('amount_currency', 0.0) * 2,
        }])
        self.assertRecordValues(suspense_lines, [{
            'debit': expected_counterpart_values.get('debit', 0.0) * 2,
            'credit': expected_counterpart_values.get('credit', 0.0) * 2,
            'amount_currency': expected_counterpart_values.get('amount_currency', 0.0) * 2,
        }])

        # Check the account.bank.statement.line is still correct after editing the account.move.
        statement_line.move_id.write({'line_ids': [
            (1, liquidity_lines.id, {
                'debit': expected_liquidity_values.get('debit', 0.0),
                'credit': expected_liquidity_values.get('credit', 0.0),
                'amount_currency': expected_liquidity_values.get('amount_currency', 0.0),
            }),
            (1, suspense_lines.id, {
                'debit': expected_counterpart_values.get('debit', 0.0),
                'credit': expected_counterpart_values.get('credit', 0.0),
                'amount_currency': expected_counterpart_values.get('amount_currency', 0.0),
            }),
        ]})
        self.assertRecordValues(statement_line, [{
            'amount': amount,
            'amount_currency': amount_currency,
        }])

    def _test_edition_customer_and_supplier_flows(
            self,
            amount, amount_currency,
            journal_currency, foreign_currency,
            expected_liquidity_values, expected_counterpart_values):
        ''' Test '_test_statement_line_edition' using the customer (positive amounts)
        & the supplier flow (negative amounts).
        :param amount:                      The amount in journal's currency.
        :param amount_currency:             The amount in the foreign currency.
        :param journal_currency:            The journal's currency as a res.currency record.
        :param foreign_currency:            The foreign currency as a res.currency record.
        :param expected_liquidity_values:   The expected account.move.line values for the liquidity line.
        :param expected_counterpart_values: The expected account.move.line values for the counterpart line.
        '''

        # Check the full process with positive amount (customer process).
        self._test_statement_line_edition(
            self.bank_journal_2,
            amount, amount_currency,
            journal_currency, foreign_currency,
            expected_liquidity_values,
            expected_counterpart_values,
        )

        # Check the full process with negative amount (supplier process).
        self._test_statement_line_edition(
            self.bank_journal_3,
            -amount, -amount_currency,
            journal_currency, foreign_currency,
            {
                **expected_liquidity_values,
                'debit': expected_liquidity_values.get('credit', 0.0),
                'credit': expected_liquidity_values.get('debit', 0.0),
                'amount_currency': -expected_liquidity_values.get('amount_currency', 0.0),
            },
            {
                **expected_counterpart_values,
                'debit': expected_counterpart_values.get('credit', 0.0),
                'credit': expected_counterpart_values.get('debit', 0.0),
                'amount_currency': -expected_counterpart_values.get('amount_currency', 0.0),
            },
        )

    def test_edition_journal_curr_2_statement_curr_3(self):
        self._test_edition_customer_and_supplier_flows(
            80.0,               120.0,
            self.currency_2,    self.currency_3,
            {'debit': 40.0,     'credit': 0.0,      'amount_currency': 80.0,        'currency_id': self.currency_2.id},
            {'debit': 0.0,      'credit': 40.0,     'amount_currency': -120.0,      'currency_id': self.currency_3.id},
        )

    def test_edition_journal_curr_2_statement_curr_1(self):
        self._test_edition_customer_and_supplier_flows(
            120.0,              80.0,
            self.currency_2,    self.currency_1,
            {'debit': 80.0,     'credit': 0.0,      'amount_currency': 120.0,       'currency_id': self.currency_2.id},
            {'debit': 0.0,      'credit': 80.0,     'amount_currency': -80.0,       'currency_id': self.currency_1.id},
        )

    def test_edition_journal_curr_1_statement_curr_2(self):
        self._test_edition_customer_and_supplier_flows(
            # pylint: disable=C0326
            80.0,               120.0,
            self.currency_1,    self.currency_2,
            {'debit': 80.0,     'credit': 0.0,      'amount_currency': 80.0,        'currency_id': self.currency_1.id},
            {'debit': 0.0,      'credit': 80.0,     'amount_currency': -120.0,      'currency_id': self.currency_2.id},
        )

    def test_edition_journal_curr_2_statement_false(self):
        self._test_edition_customer_and_supplier_flows(
            80.0,               0.0,
            self.currency_2,    False,
            {'debit': 40.0,     'credit': 0.0,      'amount_currency': 80.0,        'currency_id': self.currency_2.id},
            {'debit': 0.0,      'credit': 40.0,     'amount_currency': -80.0,       'currency_id': self.currency_2.id},
        )

    def test_edition_journal_curr_1_statement_false(self):
        self._test_edition_customer_and_supplier_flows(
            80.0,               0.0,
            self.currency_1,    False,
            {'debit': 80.0,     'credit': 0.0,      'amount_currency': 80.0,        'currency_id': self.currency_1.id},
            {'debit': 0.0,      'credit': 80.0,     'amount_currency': -80.0,       'currency_id': self.currency_1.id},
        )

    def test_zero_amount_journal_curr_1_statement_curr_2(self):
        self.bank_journal_2.currency_id = self.currency_1

        statement_line = self.env['account.bank.statement.line'].create({
            'journal_id': self.bank_journal_2.id,
            'date': '2019-01-01',
            'payment_ref': 'line_1',
            'partner_id': self.partner_a.id,
            'foreign_currency_id': self.currency_2.id,
            'amount': 0.0,
            'amount_currency': 10.0,
        })

        self.assertRecordValues(statement_line.line_ids, [
            # pylint: disable=C0326
            {'debit': 0.0,      'credit': 0.0,      'amount_currency': 0.0,         'currency_id': self.currency_1.id},
            {'debit': 0.0,      'credit': 0.0,      'amount_currency': -10.0,       'currency_id': self.currency_2.id},
        ])

    def test_zero_amount_currency_journal_curr_1_statement_curr_2(self):
        self.bank_journal_2.currency_id = self.currency_1

        statement_line = self.env['account.bank.statement.line'].create({
            'journal_id': self.bank_journal_2.id,
            'date': '2019-01-01',
            'payment_ref': 'line_1',
            'partner_id': self.partner_a.id,
            'foreign_currency_id': self.currency_2.id,
            'amount': 10.0,
            'amount_currency': 0.0,
        })

        self.assertRecordValues(statement_line.move_id.line_ids, [
            # pylint: disable=C0326
            {'debit': 10.0,     'credit': 0.0,      'amount_currency': 10.0,        'currency_id': self.currency_1.id},
            {'debit': 0.0,      'credit': 10.0,     'amount_currency': 0.0,         'currency_id': self.currency_2.id},
        ])

    def test_zero_amount_journal_curr_2_statement_curr_1(self):
        self.bank_journal_2.currency_id = self.currency_2

        statement_line = self.env['account.bank.statement.line'].create({
            'journal_id': self.bank_journal_2.id,
            'date': '2019-01-01',
            'payment_ref': 'line_1',
            'partner_id': self.partner_a.id,
            'foreign_currency_id': self.currency_1.id,
            'amount': 0.0,
            'amount_currency': 10.0,
        })

        self.assertRecordValues(statement_line.move_id.line_ids, [
            {'debit': 10.0,     'credit': 0.0,      'amount_currency': 0.0,         'currency_id': self.currency_2.id},
            {'debit': 0.0,      'credit': 10.0,     'amount_currency': -10.0,       'currency_id': self.currency_1.id},
        ])

    def test_zero_amount_currency_journal_curr_2_statement_curr_1(self):
        self.bank_journal_2.currency_id = self.currency_2

        statement_line = self.env['account.bank.statement.line'].create({
            'journal_id': self.bank_journal_2.id,
            'date': '2019-01-01',
            'payment_ref': 'line_1',
            'partner_id': self.partner_a.id,
            'foreign_currency_id': self.currency_1.id,
            'amount': 10.0,
            'amount_currency': 0.0,
        })

        self.assertRecordValues(statement_line.move_id.line_ids, [
            {'debit': 0.0,      'credit': 0.0,      'amount_currency': 10.0,        'currency_id': self.currency_2.id},
            {'debit': 0.0,      'credit': 0.0,      'amount_currency': 0.0,         'currency_id': self.currency_1.id},
        ])

    # def test_zero_amount_journal_curr_2_statement_curr_3(self):
    #     self.bank_journal_2.currency_id = self.currency_2
    #
    #     statement_line = self.env['account.bank.statement'].create({
    #         'journal_id': self.bank_journal_2.id,
    #         'date': '2019-01-01',
    #         'payment_ref': 'line_1',
    #         'partner_id': self.partner_a.id,
    #         'foreign_currency_id': self.currency_3.id,
    #         'amount': 0.0,
    #         'amount_currency': 10.0,
    #     })
    #
    #     self.assertRecordValues(statement_line.move_id.line_ids, [
    #         {'debit': 0.0,      'credit': 0.0,      'amount_currency': 0.0,         'currency_id': self.currency_2.id},
    #         {'debit': 0.0,      'credit': 0.0,      'amount_currency': -10.0,       'currency_id': self.currency_3.id},
    #     ])

    # def test_zero_amount_currency_journal_curr_2_statement_curr_3(self):
    #     self.bank_journal_2.currency_id = self.currency_2
    #
    #     statement_line = self.env['account.bank.statement'].create({
    #         'journal_id': self.bank_journal_2.id,
    #         'date': '2019-01-01',
    #         'payment_ref': 'line_1',
    #         'partner_id': self.partner_a.id,
    #         'foreign_currency_id': self.currency_3.id,
    #         'amount': 10.0,
    #         'amount_currency': 0.0,
    #     })
    #
    #     self.assertRecordValues(statement_line.move_id.line_ids, [
    #         {'debit': 5.0,      'credit': 0.0,      'amount_currency': 10.0,        'currency_id': self.currency_2.id},
    #         {'debit': 0.0,      'credit': 5.0,      'amount_currency': 0.0,         'currency_id': self.currency_3.id},
    #     ])

    def test_constraints(self):
        def assertStatementLineConstraint(statement_line_vals):
            with self.assertRaises(Exception), self.cr.savepoint():
                self.env['account.bank.statement.line'].create(statement_line_vals)

        statement_line_vals = {
            'journal_id': self.bank_journal_2.id,
            'date': '2019-01-01',
            'payment_ref': 'line_1',
            'partner_id': self.partner_a.id,
            'foreign_currency_id': False,
            'amount': 10.0,
            'amount_currency': 0.0,
        }

        # ==== Test constraints at creation ====

        # Foreign currency must not be the same as the journal one.
        assertStatementLineConstraint({
            **statement_line_vals,
            'foreign_currency_id': self.currency_1.id,
        })

        # Can't have a stand alone amount in foreign currency without foreign currency set.
        assertStatementLineConstraint({
            **statement_line_vals,
            'amount_currency': 10.0,
        })

        # ==== Test constraints at edition ====

        st_line = self.env['account.bank.statement.line'].create(statement_line_vals)

        # You can't messed up the journal entry by adding another liquidity line.
        addition_lines_to_create = [
            {
                'debit': 1.0,
                'credit': 0,
                'account_id': self.bank_journal_2.default_account_id.id,
                'move_id': st_line.move_id.id,
            },
            {
                'debit': 0,
                'credit': 1.0,
                'account_id': self.company_data['default_account_revenue'].id,
                'move_id': st_line.move_id.id,
            },
        ]
        with self.assertRaises(UserError), self.cr.savepoint():
            st_line.move_id.write({
                'line_ids': [(0, 0, vals) for vals in addition_lines_to_create]
            })

        with self.assertRaises(UserError), self.cr.savepoint():
            st_line.line_ids.create(addition_lines_to_create)

        # You can't set the journal entry in an unconsistent state.
        # with self.assertRaises(UserError), self.cr.savepoint():
        #     st_line.move_id.action_post()

    def test_statement_line_move_onchange_1(self):
        ''' Test the consistency between the account.bank.statement.line and the generated account.move.lines
        using the form view emulator.
        '''

        # Check the initial state of the statement line.
        self.assertBankStatementLine(self.statement_line, self.expected_st_line, [self.expected_counterpart_line, self.expected_bank_line])

        # Inverse the amount + change them.
        self.statement_line.write({
            'amount': -2000.0,
            'amount_currency': -4000.0,
            'foreign_currency_id': self.currency_3.id,
        })

        self.assertBankStatementLine(self.statement_line, {
            **self.expected_st_line,
            'amount': -2000.0,
            'amount_currency': -4000.0,
            'foreign_currency_id': self.currency_3.id,
        }, [
            {
                **self.expected_bank_line,
                'debit': 0.0,
                'credit': 2000.0,
                'amount_currency': -2000.0,
                'currency_id': self.currency_1.id,
            },
            {
                **self.expected_counterpart_line,
                'debit': 2000.0,
                'credit': 0.0,
                'amount_currency': 4000.0,
                'currency_id': self.currency_3.id,
            },
        ])

        # Check changing the label and the partner.
        self.statement_line.write({
            'payment_ref': 'line_1 (bis)',
            'partner_id': self.partner_b.id,
        })

        self.assertBankStatementLine(self.statement_line, {
            **self.expected_st_line,
            'payment_ref': self.statement_line.payment_ref,
            'partner_id': self.statement_line.partner_id.id,
            'amount': -2000.0,
            'amount_currency': -4000.0,
            'foreign_currency_id': self.currency_3.id,
        }, [
            {
                **self.expected_bank_line,
                'name': self.statement_line.payment_ref,
                'partner_id': self.statement_line.partner_id.id,
                'debit': 0.0,
                'credit': 2000.0,
                'amount_currency': -2000.0,
                'currency_id': self.currency_1.id,
            },
            {
                **self.expected_counterpart_line,
                'name': self.statement_line.payment_ref,
                'partner_id': self.statement_line.partner_id.id,
                'debit': 2000.0,
                'credit': 0.0,
                'amount_currency': 4000.0,
                'currency_id': self.currency_3.id,
            },
        ])

    def test_prepare_counterpart_amounts_using_st_line_rate(self):

        def assertAppliedRate(
            journal_currency, foreign_currency, aml_currency,
            amount, amount_currency, aml_amount_currency, aml_balance,
            expected_amount_currency, expected_balance,
        ):
            journal = self.bank_journal_1.copy()
            journal.currency_id = journal_currency

            statement_line = self.env['account.bank.statement.line'].create({
                'journal_id': journal.id,
                'date': '2019-01-01',
                'payment_ref': 'test_prepare_counterpart_amounts_using_st_line_rate',
                'foreign_currency_id': foreign_currency.id if foreign_currency != journal_currency else None,
                'amount': amount,
                'amount_currency': amount_currency if foreign_currency != journal_currency else 0.0,
            })

            res = statement_line._prepare_counterpart_amounts_using_st_line_rate(aml_currency, -aml_balance, -aml_amount_currency)
            self.assertAlmostEqual(res['amount_currency'], expected_amount_currency)
            self.assertAlmostEqual(res['balance'], expected_balance)

        for params in (
            (self.currency_2, self.currency_3, self.currency_3, 80.0, 120.0, 120.0, 20.0, -120.0, -40.0),
            (self.currency_2, self.currency_1, self.currency_2, 120.0, 80.0, 120.0, 40.0, -80.0, -80.0),
            (self.currency_2, self.currency_3, self.currency_2, 80.0, 120.0, 80.0, 26.67, -120.0, -40.0),
            (self.currency_2, self.currency_3, self.currency_4, 80.0, 120.0, 480.0, 40.0, -120.0, -40.0),
            (self.currency_1, self.currency_2, self.currency_2, 80.0, 120.0, 120.0, 40.0, -120.0, -80.0),
            (self.currency_1, self.currency_2, self.currency_3, 80.0, 120.0, 480.0, 80.0, -120.0, -80.0),
            (self.currency_2, self.currency_2, self.currency_2, 80.0, 80.0, 80.0, 26.67, -80.0, -40.0),
            (self.currency_2, self.currency_2, self.currency_3, 80.0, 80.0, 240.0, 40.0, -80.0, -40.0),
            (self.currency_1, self.currency_1, self.currency_3, 80.0, 80.0, 480.0, 80.0, -80.0, -80.0),
            (self.currency_2, self.currency_1, self.currency_1, 120.0, 80.0, 80.0, 80.0, -80.0, -80.0),
            (self.currency_2, self.currency_3, self.currency_1, 80.0, 120.0, 40.0, 40.0, -120.0, -40.0),
            (self.currency_1, self.currency_2, self.currency_1, 80.0, 120.0, 80.0, 80.0, -120.0, -80.0),
            (self.currency_2, self.currency_2, self.currency_1, 80.0, 80.0, 40.0, 40.0, -80.0, -40.0),
            (self.currency_1, self.currency_1, self.currency_1, 80.0, 80.0, 80.0, 80.0, -80.0, -80.0),
        ):
            with self.subTest(params=params):
                assertAppliedRate(*params)

    def test_zero_amount_statement_line(self):
        ''' Ensure the statement line is directly marked as reconciled when having an amount of zero. '''
        self.company_data['company'].account_journal_suspense_account_id.reconcile = False

        statement = self.env['account.bank.statement'].with_context(skip_check_amounts_currencies=True).create({
            'name': 'test_statement',
            'line_ids': [
                (0, 0, {
                    'date': '2019-01-01',
                    'payment_ref': "Happy new year",
                    'amount': 0.0,
                    'journal_id': self.bank_journal_2.id,
                }),
            ],
        })
        statement_line = statement.line_ids

        self.assertRecordValues(statement_line, [{'is_reconciled': True, 'amount_residual': 0.0}])

    def test_statement_line_ordering_by_date(self):

        self.env.user.company_id = self.company_data_2['company']

        self.assertRecordValues(
            self.st_lines,
            [
                {'amount': 7, 'cumulative_balance': 28},
                {'amount': 6, 'cumulative_balance': 21},
                {'amount': 5, 'cumulative_balance': 15},
                {'amount': 4, 'cumulative_balance': 10},
                {'amount': 3, 'cumulative_balance': 6},
                {'amount': 2, 'cumulative_balance': 3},
                {'amount': 1, 'cumulative_balance': 1},
            ],
        )

        # change the date of 7 to be before the first one
        self.st_lines.filtered(lambda l: l.amount == 7).date = '2020-01-05'
        self.assertRecordValues(
            self.st_lines.sorted(),
            [
                {'amount': 6, 'cumulative_balance': 28},
                {'amount': 5, 'cumulative_balance': 22},
                {'amount': 4, 'cumulative_balance': 17},
                {'amount': 3, 'cumulative_balance': 13},
                {'amount': 2, 'cumulative_balance': 10},
                {'amount': 1, 'cumulative_balance': 8},
                {'amount': 7, 'cumulative_balance': 7},

            ],
        )

        # swap the date of 7 and 2
        self.st_lines.filtered(lambda l: l.amount == 7).date = '2020-01-11'
        self.st_lines.filtered(lambda l: l.amount == 2).date = '2020-01-05'
        self.assertRecordValues(
            self.st_lines.sorted(),
            [
                {'amount': 6, 'cumulative_balance': 28},
                {'amount': 5, 'cumulative_balance': 22},
                {'amount': 4, 'cumulative_balance': 17},
                {'amount': 3, 'cumulative_balance': 13},
                {'amount': 7, 'cumulative_balance': 10},
                {'amount': 1, 'cumulative_balance': 3},
                {'amount': 2, 'cumulative_balance': 2},
            ],
        )

        # change the amount of 1 to be negative
        self.st_lines.filtered(lambda l: l.amount == 1).amount = -1
        self.assertRecordValues(
            self.st_lines.sorted(),
            [
                {'amount': 6, 'cumulative_balance': 26},
                {'amount': 5, 'cumulative_balance': 20},
                {'amount': 4, 'cumulative_balance': 15},
                {'amount': 3, 'cumulative_balance': 11},
                {'amount': 7, 'cumulative_balance': 8},
                {'amount': -1, 'cumulative_balance': 1},
                {'amount': 2, 'cumulative_balance': 2},
            ],
        )
        # erase no 3
        self.st_lines.filtered(lambda l: l.amount == 3).unlink()
        self.assertRecordValues(
            self.st_lines.sorted(),
            [
                {'amount': 6, 'cumulative_balance': 23},
                {'amount': 5, 'cumulative_balance': 17},
                {'amount': 4, 'cumulative_balance': 12},
                {'amount': 7, 'cumulative_balance': 8},
                {'amount': -1, 'cumulative_balance': 1},
                {'amount': 2, 'cumulative_balance': 2},

            ],
        )

        # insert a new line with between 2 and 1
        self.create_bank_transaction(
            amount=8,
            date='2020-01-08',
        )
        self.assertRecordValues(
            self.env['account.bank.statement.line'].search([('company_id', '=', self.env.company.id)]),
            [
                {'amount': 6, 'cumulative_balance': 31},
                {'amount': 5, 'cumulative_balance': 25},
                {'amount': 4, 'cumulative_balance': 20},
                {'amount': 7, 'cumulative_balance': 16},
                {'amount': -1, 'cumulative_balance': 9},
                {'amount': 8, 'cumulative_balance': 10},
                {'amount': 2, 'cumulative_balance': 2},
            ],
        )

    def test_statement_line_ordering_by_sequence(self):

        self.env.user.company_id = self.company_data_2['company']
        # swap line 6 and 7 by sequence
        self.st_lines.filtered(lambda l: l.amount == 7).sequence += 1
        self.assertRecordValues(
            self.st_lines.sorted(),
            [
                {'amount': 6, 'cumulative_balance': 28},
                {'amount': 7, 'cumulative_balance': 22},
                {'amount': 5, 'cumulative_balance': 15},
                {'amount': 4, 'cumulative_balance': 10},
                {'amount': 3, 'cumulative_balance': 6},
                {'amount': 2, 'cumulative_balance': 3},
                {'amount': 1, 'cumulative_balance': 1},
            ],
        )
        # add a line before 3 with the same date
        self.create_bank_transaction(
            amount=8,
            date='2020-01-12',
            sequence=2,
        )
        self.assertRecordValues(
            self.env['account.bank.statement.line'].search([('company_id', '=', self.env.company.id)]),
            [
                {'amount': 6, 'cumulative_balance': 36},
                {'amount': 7, 'cumulative_balance': 30},
                {'amount': 5, 'cumulative_balance': 23},
                {'amount': 4, 'cumulative_balance': 18},
                {'amount': 3, 'cumulative_balance': 14},
                {'amount': 8, 'cumulative_balance': 11},
                {'amount': 2, 'cumulative_balance': 3},
                {'amount': 1, 'cumulative_balance': 1},
            ],
        )

        # change the sequence of 3 to move it before 5
        self.st_lines.filtered(lambda l: l.amount == 3).sequence = -1
        self.assertRecordValues(
            self.env['account.bank.statement.line'].search([('company_id', '=', self.env.company.id)]),
            [
                {'amount': 6, 'cumulative_balance': 36},
                {'amount': 7, 'cumulative_balance': 30},
                {'amount': 3, 'cumulative_balance': 23},
                {'amount': 5, 'cumulative_balance': 20},
                {'amount': 4, 'cumulative_balance': 15},
                {'amount': 8, 'cumulative_balance': 11},
                {'amount': 2, 'cumulative_balance': 3},
                {'amount': 1, 'cumulative_balance': 1},
            ],
        )

    def test_statement_assignation(self):

        def get_line(amount):
            return self.env['account.bank.statement.line'].search([('amount', '=', amount)])

        self.env.user.company_id = self.company_data_2['company']

        statement1 = self.env['account.bank.statement'].create({
            'name': 'statement1',
            'balance_start_real': 0.0,
            'balance_end_real': 7.0,
            'line_ids': [Command.set((self.st_lines.filtered(lambda l: l.amount in (1, 2, 4))).ids)],
        })

        self.assertRecordValues(
            self.st_lines,
            [
                {'amount': 7, 'statement_id': False, 'cumulative_balance': 28},
                {'amount': 6, 'statement_id': False, 'cumulative_balance': 21},
                {'amount': 5, 'statement_id': False, 'cumulative_balance': 15},
                {'amount': 4, 'statement_id': statement1.id, 'cumulative_balance': 10},
                {'amount': 3, 'statement_id': False, 'cumulative_balance': 6},
                {'amount': 2, 'statement_id': statement1.id, 'cumulative_balance': 3},
                {'amount': 1, 'statement_id': statement1.id, 'cumulative_balance': 1},
            ],
        )
        self.assertRecordValues(
            statement1,
            [{
                'balance_start': 0.0,
                'balance_end': 10.0,
                'first_line_id': get_line(1).id,
                'last_line_id': get_line(4).id,
                'date': fields.Date.from_string('2020-01-12'),
                'is_valid': False,  # there is a gap, sum mismatch
                'is_difference_zero': False,
                'total_entry_encoding': 7.0,
                'difference': -3.0,
            }],
        )
        statement1.balance_end_real = 10.0
        self.assertRecordValues(
            statement1,
            [{
                'is_valid': True,  # there is a gap, but we don't care
                'is_difference_zero': True,
            }],
        )

        get_line(3).statement_id = statement1.id
        self.assertRecordValues(
            statement1,
            [{
                'balance_start': 0.0,
                'balance_end': 10.0,
                'first_line_id': get_line(1).id,
                'last_line_id': get_line(4).id,
                'total_entry_encoding': 10.0,
                'is_valid': True,
                'is_difference_zero': True,
            }]
        )
        # add a proper statement
        statement2 = self.env['account.bank.statement'].create({
            'name': 'statement2',
            'balance_start_real': 15.0,
            'balance_end_real': 28.0,
            'line_ids': [Command.set((get_line(6) + get_line(7)).ids)],
        })

        self.assertRecordValues(
            self.st_lines,
            [
                {'amount': 7, 'statement_id': statement2.id, 'cumulative_balance': 28},
                {'amount': 6, 'statement_id': statement2.id, 'cumulative_balance': 21},
                {'amount': 5, 'statement_id': False, 'cumulative_balance': 15},
                {'amount': 4, 'statement_id': statement1.id, 'cumulative_balance': 10},
                {'amount': 3, 'statement_id': statement1.id, 'cumulative_balance': 6},
                {'amount': 2, 'statement_id': statement1.id, 'cumulative_balance': 3},
                {'amount': 1, 'statement_id': statement1.id, 'cumulative_balance': 1},
            ],
        )

        self.assertRecordValues(
            statement2,
            [{
                'balance_start': 15.0,
                'balance_end': 28.0,
                'is_valid': False,  # there is a gap before
                'is_difference_zero': True,
            }],
        )

        # add statement 3 to reach a clean state
        statement3 = self.env['account.bank.statement'].create({
            'name': 'statement3',
            'balance_start_real': 10.0,
            'balance_end_real': 15.0,
            'line_ids': [Command.set(get_line(5).ids)],
        })

        self.assertRecordValues(
            self.st_lines,
            [
                {'amount': 7, 'statement_id': statement2.id, 'cumulative_balance': 28},
                {'amount': 6, 'statement_id': statement2.id, 'cumulative_balance': 21},
                {'amount': 5, 'statement_id': statement3.id, 'cumulative_balance': 15},
                {'amount': 4, 'statement_id': statement1.id, 'cumulative_balance': 10},
                {'amount': 3, 'statement_id': statement1.id, 'cumulative_balance': 6},
                {'amount': 2, 'statement_id': statement1.id, 'cumulative_balance': 3},
                {'amount': 1, 'statement_id': statement1.id, 'cumulative_balance': 1},
            ],
        )
        self.assertRecordValues(
            statement3 + statement2 + statement1,
            [
                {
                    'is_difference_zero': True,
                    'is_valid': True,
                },
                {
                    'is_difference_zero': True,
                    'is_valid': True,
                },
                {
                    'is_difference_zero': True,
                    'is_valid': True,
                },
            ],
        )

        # remove statement3
        get_line(5).statement_id = statement1.id
        self.assertRecordValues(
            self.st_lines,
            [
                {'amount': 7, 'statement_id': statement2.id, 'cumulative_balance': 28},
                {'amount': 6, 'statement_id': statement2.id, 'cumulative_balance': 21},
                {'amount': 5, 'statement_id': statement1.id, 'cumulative_balance': 15},
                {'amount': 4, 'statement_id': statement1.id, 'cumulative_balance': 10},
                {'amount': 3, 'statement_id': statement1.id, 'cumulative_balance': 6},
                {'amount': 2, 'statement_id': statement1.id, 'cumulative_balance': 3},
                {'amount': 1, 'statement_id': statement1.id, 'cumulative_balance': 1},
            ],
        )
        self.assertRecordValues(
            statement1 + statement2,
            [
                {
                    'balance_start': 0.0,
                    'balance_end': 15.0,
                    'is_difference_zero': False,  # balance_end_real: 10.0,
                    'is_valid': False,
                },
                {
                    'balance_start': 15.0,
                    'balance_end': 28.0,
                    'is_difference_zero': True,
                    'is_valid': False,  # previous statement balance_end_real != balance_start
                },
            ],
        )
        # fixup statement1
        statement1.balance_end_real = 15.0
        self.assertTrue(statement1.is_valid)
        self.assertTrue(statement2.is_valid)

        # change in first and last lines
        statement1.balance_end_real = 10.0
        get_line(5).statement_id = statement2.id
        self.assertRecordValues(
            self.st_lines,
            [
                {'amount': 7, 'statement_id': statement2.id, 'cumulative_balance': 28},
                {'amount': 6, 'statement_id': statement2.id, 'cumulative_balance': 21},
                {'amount': 5, 'statement_id': statement2.id, 'cumulative_balance': 15},
                {'amount': 4, 'statement_id': statement1.id, 'cumulative_balance': 10},
                {'amount': 3, 'statement_id': statement1.id, 'cumulative_balance': 6},
                {'amount': 2, 'statement_id': statement1.id, 'cumulative_balance': 3},
                {'amount': 1, 'statement_id': statement1.id, 'cumulative_balance': 1},
            ],
        )
        self.assertRecordValues(
            statement1 + statement2,
            [
                {
                    'balance_start': 0.0,
                    'balance_end': 10.0,
                    'is_difference_zero': True,
                    'is_valid': True,
                },
                {
                    'balance_start': 10.0,
                    'balance_end': 28.0,
                    'is_difference_zero': True,
                    'is_valid': False,
                },
            ],
        )
        # make a mess
        get_line(2).statement_id = statement2.id

        self.assertRecordValues(
            self.st_lines,
            [
                {'amount': 7, 'statement_id': statement2.id, 'cumulative_balance': 28},
                {'amount': 6, 'statement_id': statement2.id, 'cumulative_balance': 21},
                {'amount': 5, 'statement_id': statement2.id, 'cumulative_balance': 15},
                {'amount': 4, 'statement_id': statement1.id, 'cumulative_balance': 10},
                {'amount': 3, 'statement_id': statement1.id, 'cumulative_balance': 6},
                {'amount': 2, 'statement_id': statement2.id, 'cumulative_balance': 3},
                {'amount': 1, 'statement_id': statement1.id, 'cumulative_balance': 1},
            ],
        )
        self.assertRecordValues(
            statement1 + statement2,
            [
                {
                    'balance_start': 0.0,
                    'balance_end': 10.0,
                    'is_difference_zero': True,
                    'is_valid': False,
                },
                {
                    'balance_start': 1.0,
                    'balance_end': 28.0,
                    'is_difference_zero': True,
                    'is_valid': False,
                },
            ],
        )

        # remove messy line
        get_line(2).unlink()
        self.assertRecordValues(
            self.env['account.bank.statement.line'].search([('company_id', '=', self.env.company.id)]),
            [
                {'amount': 7, 'statement_id': statement2.id, 'cumulative_balance': 26},
                {'amount': 6, 'statement_id': statement2.id, 'cumulative_balance': 19},
                {'amount': 5, 'statement_id': statement2.id, 'cumulative_balance': 13},
                {'amount': 4, 'statement_id': statement1.id, 'cumulative_balance': 8},
                {'amount': 3, 'statement_id': statement1.id, 'cumulative_balance': 4},
                {'amount': 1, 'statement_id': statement1.id, 'cumulative_balance': 1},
            ],
        )
        self.assertRecordValues(
            statement1 + statement2,
            [
                {
                    'balance_start': 0.0,
                    'balance_end': 8.0,
                    'is_difference_zero': False,
                    'is_valid': False,
                    'difference': 2.0,
                },
                {
                    'balance_start': 8.0,
                    'balance_end': 26.0,
                    'is_difference_zero': False,
                    'is_valid': False,
                    'difference': 2.0,
                },
            ],
        )
        # make it clean again
        statement1.balance_end_real = 8.0
        statement2.balance_end_real = 26.0
        statement2.balance_start_real = 8.0
        self.assertFalse(statement2.error_message)
        self.assertRecordValues(
            statement1 + statement2,
            [
                {
                    'is_difference_zero': True,
                    'is_valid': True,
                },
                {
                    'is_difference_zero': True,
                    'is_valid': True,
                },
            ],
        )
        # remove two lines ae same time from start and end of two statements
        (get_line(5)+get_line(6)).unlink()
        self.assertRecordValues(
            self.env['account.bank.statement.line'].search([('company_id', '=', self.env.company.id)]),
            [
                {'amount': 7, 'statement_id': statement2.id, 'cumulative_balance': 15},
                {'amount': 4, 'statement_id': statement1.id, 'cumulative_balance': 8},
                {'amount': 3, 'statement_id': statement1.id, 'cumulative_balance': 4},
                {'amount': 1, 'statement_id': statement1.id, 'cumulative_balance': 1},
            ],
        )
        # make it valid again
        statement1.balance_end_real = 8.0
        statement2.balance_end_real = 15.0
        statement2.balance_start_real = 8.0
        self.assertRecordValues(
            statement1 + statement2,
            [
                {
                    'is_difference_zero': True,
                    'is_valid': True,
                },
                {
                    'is_difference_zero': True,
                    'is_valid': True,
                },
            ],
        )
        # change a line value
        get_line(3).amount = -3
        self.assertRecordValues(
            self.env['account.bank.statement.line'].search([('company_id', '=', self.env.company.id)]),
            [
                {'amount': 7, 'statement_id': statement2.id, 'cumulative_balance': 9},
                {'amount': 4, 'statement_id': statement1.id, 'cumulative_balance': 2},
                {'amount': -3, 'statement_id': statement1.id, 'cumulative_balance': -2},
                {'amount': 1, 'statement_id': statement1.id, 'cumulative_balance': 1},
            ],
        )
        self.assertRecordValues(
            statement1 + statement2,
            [
                {
                    'balance_start': 0.0,
                    'balance_end': 2.0,
                    'is_difference_zero': False,
                    'is_valid': False,
                    'difference': 6.0,
                },
                {
                    'balance_start': 2.0,
                    'balance_end': 9.0,
                    'is_difference_zero': False,
                    'is_valid': False,
                    'difference': 6.0,
                },
            ],
        )

        # add a new line with statement
        self.create_bank_transaction(amount=8, statement=statement1, date='2020-01-10', sequence=-1)
        self.assertRecordValues(
            self.env['account.bank.statement.line'].search([('company_id', '=', self.env.company.id)]),
            [
                {'amount': 7, 'statement_id': statement2.id, 'cumulative_balance': 17},
                {'amount': 4, 'statement_id': statement1.id, 'cumulative_balance': 10},
                {'amount': -3, 'statement_id': statement1.id, 'cumulative_balance': 6},
                {'amount': 8, 'statement_id': statement1.id, 'cumulative_balance': 9},
                {'amount': 1, 'statement_id': statement1.id, 'cumulative_balance': 1},
            ],
        )

        self.assertRecordValues(
            statement1 + statement2,
            [
                {
                    'balance_start': 0.0,
                    'balance_end': 10,
                    'is_difference_zero': False,
                    'is_valid': False,
                    'difference': -2.0,
                },
                {
                    'balance_start': 10.0,
                    'balance_end': 17.0,
                    'is_difference_zero': False,
                    'is_valid': False,
                    'difference': -2.0,
                },
            ],
        )

    def test_autofill_statement(self):
        self.env.user.company_id = self.company_data_2['company']

        statement1 = self.env['account.bank.statement'].create({
            'name': 'statement1',
            'balance_start_real': 0.0,
            'balance_end_real': 18.0,
            'line_ids': [Command.set((self.st_lines.filtered(lambda l: l.amount in (1, 2, 3, 4))).ids)],
        })

        self.assertFalse(statement1.is_difference_zero)
        new_line = self.create_bank_transaction(amount=8, date='2020-01-11')
        self.assertRecordValues(
            self.env['account.bank.statement.line'].search([('company_id', '=', self.env.company.id)]),
            [
                {'amount': 7, 'cumulative_balance': 36},
                {'amount': 6, 'cumulative_balance': 29},
                {'amount': 5, 'cumulative_balance': 23},
                {'amount': 4, 'cumulative_balance': 18},
                {'amount': 3, 'cumulative_balance': 14},
                {'amount': 8, 'cumulative_balance': 11},
                {'amount': 2, 'cumulative_balance': 3},
                {'amount': 1, 'cumulative_balance': 1},
            ],
        )
        # statement1 end_balance_real is not valid, so we add a line to it
        self.assertRecordValues(new_line, [{'statement_id': statement1.id}])

        # statement1's end balance is now valid, so we do not suggest it for the new line
        self.assertTrue(statement1.is_difference_zero)

        new_line = self.create_bank_transaction(amount=9, date='2020-01-11')
        self.assertRecordValues(new_line, [{'statement_id': False}])
