# -*- coding: utf-8 -*-
from odoo.addons.account.tests.common import AccountTestInvoicingCommon
from odoo.tests import tagged
from odoo.exceptions import UserError, ValidationError


@tagged('post_install', '-at_install')
class TestAccountJournal(AccountTestInvoicingCommon):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        # Create another company.
        cls.company_data_2 = cls.setup_company_data('company_2_data')

        # By default, tests are run with the current user set on the first company.
        cls.env.user.company_id = cls.company_data['company']

    def test_changing_journal_company(self):
        ''' Ensure you can't change the company of an account.journal if there are some journal entries '''

        self.env['account.move'].create({
            'move_type': 'entry',
            'date': '2019-01-01',
            'journal_id': self.company_data['default_journal_sale'].id,
        })

        with self.assertRaises(UserError), self.cr.savepoint():
            self.company_data['default_journal_sale'].company_id = self.company_data_2['company']

    def test_constraint_currency_consistency_with_accounts(self):
        ''' Ensure the accounts linked to a bank/cash journal are sharing the same foreign currency. '''
        journal_bank = self.company_data['default_journal_bank']

        journal_bank.default_debit_account_id.currency_id = self.currency_data['currency']
        journal_bank.default_debit_account_id.currency_id = self.company_data['currency']
        journal_bank.currency_id = self.company_data['currency']
        journal_bank.default_debit_account_id.currency_id = self.currency_data['currency']
        journal_bank.currency_id = self.currency_data['currency']

        with self.assertRaises(ValidationError), self.cr.savepoint():
            journal_bank.default_debit_account_id.currency_id = self.company_data['currency']
