# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import time

from odoo.tests import common


class TestAccountBankStatement(common.TransactionCase):

    def setUp(self):
        super(TestAccountBankStatement, self).setUp()
        #Useful Models
        self.AccountBankStatement = self.env['account.bank.statement']
        self.AccountBankStatementLine = self.env['account.bank.statement.line']
        self.Account = self.env['account.account']
        #Useful IDs
        self.main_company = self.ref('base.main_company')
        self.res_partner_4 = self.ref('base.res_partner_4')
    
    def test_00_account_bank_statement(self):
        """Testing for Account Bank Statement by creating a bank statement line and confirm it and check it's move created"""
        self.data_account_type_fixed_assets = self.ref('account.data_account_type_fixed_assets')
        self.journal = self.AccountBankStatement.with_context({'lang': u'en_US', 'tz': False, 'active_model': 'ir.ui.menu', 'journal_type': 'bank', 'date': time.strftime("%Y/%m/%d")})._default_journal() 
        self.assertTrue(self.journal, 'Journal has not been selected')
        self.account_bank_statement_0 = self.AccountBankStatement.create({
            'journal_id': self.journal.id,
            'balance_end_real': 0.0,
            'balance_start': 0.0,
            'date': time.strftime('%Y-%m-%d'),
            'company_id': self.main_company
            })
        vals = {'amount': 1000, 'date': time.strftime('%Y-%m-%d'), 'partner_id': self.res_partner_4, 'name': 'EXT001', 'statement_id': self.account_bank_statement_0.id}
        self.AccountBankStatementLine.create(vals)


        account = self.Account.create({'name': 'toto', 'code': 'bidule', 'user_type_id': self.data_account_type_fixed_assets})
        self.account_bank_statement_0.line_ids[0].process_reconciliation(new_aml_dicts=[{'credit': 1000, 'debit': 0, 'name': 'toto', 'account_id': account.id}])
        
        self.account_bank_statement_0.write({'balance_end_real': 1000.0})
        self.account_bank_statement_0.button_confirm_bank()
        
        self.assertEquals(self.account_bank_statement_0.state, 'confirm', 'Bank Statement Should be Closed')
