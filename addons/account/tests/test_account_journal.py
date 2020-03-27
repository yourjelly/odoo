# -*- coding: utf-8 -*-
from odoo.addons.account.tests.common import AccountTestInvoicingCommon
from odoo.tests import tagged
from odoo.exceptions import UserError, ValidationError


@tagged('post_install', '-at_install')
class TestAccountJournal(AccountTestInvoicingCommon):

    def test_constraint_currency_consistency_with_accounts(self):
        ''' The accounts linked to a bank/cash journal must share the same foreign currency
        if specified.
        '''
        journal_bank = self.company_data['default_journal_bank']
        journal_bank.currency_id = self.currency_data['currency']

        # Try to set a different currency on the 'debit' account.
        with self.assertRaises(ValidationError), self.cr.savepoint():
            journal_bank.default_debit_account_id.currency_id = self.company_data['currency']
