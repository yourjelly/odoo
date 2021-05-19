# -*- coding: utf-8 -*-
# pylint: disable=C0326
from odoo.addons.account.tests.test_account_bank_statement import TestAccountBankStatementCommon
from odoo.tests import tagged
from odoo.tests.common import Form
from odoo.exceptions import ValidationError, UserError
from odoo import Command


@tagged('post_install', '-at_install')
class TestAccountBankStatementLineOrdering(TestAccountBankStatementCommon):

    def test_ordering_flow(self):
        def create_bank_transaction(amount, date):
            return self.env['account.bank.statement.line'].create({
                'payment_ref': str(amount),
                'amount': amount,
                'date': date,
            })

        line7 = create_bank_transaction(7, '2020-01-10')
        line2 = create_bank_transaction(2, '2020-01-13')
        line6 = create_bank_transaction(6, '2020-01-11')
        line5 = create_bank_transaction(5, '2020-01-12')
        line4 = create_bank_transaction(4, '2020-01-12')
        line1 = create_bank_transaction(1, '2020-01-13')
        line3 = create_bank_transaction(3, '2020-01-12')

        self.assertRecordValues(
            self.env['account.bank.statement.line'].search([('company_id', '=', self.env.company.id)]),
            [
                {'amount': 1, 'running_balance_end': 28},
                {'amount': 2, 'running_balance_end': 27},
                {'amount': 3, 'running_balance_end': 25},
                {'amount': 4, 'running_balance_end': 22},
                {'amount': 5, 'running_balance_end': 18},
                {'amount': 6, 'running_balance_end': 13},
                {'amount': 7, 'running_balance_end': 7},
            ],
        )

        # Same but with a subset of lines to ensure the balance is not only computed based on selected records.
        self.env['account.bank.statement.line'].flush()
        self.env['account.bank.statement.line'].invalidate_cache()
        self.assertRecordValues(
            self.env['account.bank.statement.line'].search([
                ('company_id', '=', self.env.company.id),
                ('amount', '>=', 3),
                ('amount', '<=', 6),
            ]),
            [
                {'amount': 3, 'running_balance_end': 25},
                {'amount': 4, 'running_balance_end': 22},
                {'amount': 5, 'running_balance_end': 18},
                {'amount': 6, 'running_balance_end': 13},
            ],
        )

        statement1 = self.env['account.bank.statement'].create({
            'date': line7.date,
            'line_ids': [Command.set((line7 + line6 + line4).ids)],
        })

        self.assertRecordValues(
            statement1,
            [{
                'balance_start': 0.0,
                'balance_end': 17.0,
            }],
        )

        self.env['account.bank.statement.line'].flush()
        self.env['account.bank.statement.line'].invalidate_cache()
        self.assertRecordValues(
            self.env['account.bank.statement.line'].search([('company_id', '=', self.env.company.id)]),
            [
                {'amount': 1, 'statement_id': False,            'running_balance_end': 28},
                {'amount': 2, 'statement_id': False,            'running_balance_end': 27},
                {'amount': 3, 'statement_id': False,            'running_balance_end': 25},
                {'amount': 5, 'statement_id': False,            'running_balance_end': 22},
                {'amount': 4, 'statement_id': statement1.id,    'running_balance_end': 17},
                {'amount': 6, 'statement_id': statement1.id,    'running_balance_end': 13},
                {'amount': 7, 'statement_id': statement1.id,    'running_balance_end': 7},
            ],
        )

        statement2 = self.env['account.bank.statement'].create({
            'date': line3.date,
            'line_ids': [Command.set((line3 + line2).ids)],
        })

        self.assertRecordValues(
            statement2,
            [{
                'balance_start': 22.0,
                'balance_end': 27.0,
            }],
        )

        self.env['account.bank.statement.line'].flush()
        self.env['account.bank.statement.line'].invalidate_cache()
        self.assertRecordValues(
            self.env['account.bank.statement.line'].search([('company_id', '=', self.env.company.id)]),
            [
                {'amount': 1, 'statement_id': False,            'running_balance_end': 28},
                {'amount': 2, 'statement_id': statement2.id,    'running_balance_end': 27},
                {'amount': 5, 'statement_id': False,            'running_balance_end': 25},
                {'amount': 3, 'statement_id': statement2.id,    'running_balance_end': 20},
                {'amount': 4, 'statement_id': statement1.id,    'running_balance_end': 17},
                {'amount': 6, 'statement_id': statement1.id,    'running_balance_end': 13},
                {'amount': 7, 'statement_id': statement1.id,    'running_balance_end': 7},
            ],
        )

        statement3 = self.env['account.bank.statement'].create({
            'date': line5.date,
            'line_ids': [Command.set(line5.ids)],
        })

        self.assertRecordValues(
            statement3,
            [{
                'balance_start': 20.0,
                'balance_end': 25.0,
            }],
        )

        self.env['account.bank.statement.line'].flush()
        self.env['account.bank.statement.line'].invalidate_cache()
        self.assertRecordValues(
            self.env['account.bank.statement.line'].search([('company_id', '=', self.env.company.id)]),
            [
                {'amount': 1, 'statement_id': False,            'running_balance_end': 28},
                {'amount': 2, 'statement_id': statement2.id,    'running_balance_end': 27},
                {'amount': 3, 'statement_id': statement2.id,    'running_balance_end': 25},
                {'amount': 5, 'statement_id': statement3.id,    'running_balance_end': 22},
                {'amount': 4, 'statement_id': statement1.id,    'running_balance_end': 17},
                {'amount': 6, 'statement_id': statement1.id,    'running_balance_end': 13},
                {'amount': 7, 'statement_id': statement1.id,    'running_balance_end': 7},
            ],
        )
