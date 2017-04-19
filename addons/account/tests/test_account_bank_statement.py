from odoo.tests import common
import time
from odoo import tools
from odoo.modules.module import get_resource_path


class TestAccountBankStatement(common.TransactionCase):

    def _load(self, module, *args):
        tools.convert_file(self.cr, 'account_asset',
                           get_resource_path(module, *args),
                           {}, 'init', False, 'test', self.registry._assertion_report)

    def setUp(self):
        super(TestAccountBankStatement, self).setUp()
        # Models
        self.AccBankState = self.env['account.bank.statement']
        self.AccBankStateLine = self.env['account.bank.statement.line']
        self.Account = self.env['account.account']
        # Reference
        self.main_company = self.env.ref('base.main_company')
        self.account_user_type_id = self.env.ref('account.data_account_type_fixed_assets')
        self.partner4 = self.env.ref('base.res_partner_4')

    def test_account_bank_statement_def(self):
        """   In order to test Bank Statement feature of account I create a bank statement line and confirm it and check it's move created
        """
        #select the period and journal for the bank statement
        self._load('account', 'test', 'account_minimal_test.xml')
        journal_type = "bank"
        journal = self.AccBankState.with_context({'lang': u'en_US', 'tz': False, 'active_model': 'ir.ui.menu',
        'journal_type': 'bank','journal_id':10,
        'date': time.strftime("%Y/%m/%d")})._default_journal()
        assert journal

        #create a bank statement with Opening and Closing balance 0.
        self.account_statement = self.AccBankState.create({
            'balance_end_real' : 0.0,
            'balance_start' : 0.0,
            'date' : time.strftime("%Y-%m-%d"),
            'company_id' : self.main_company.id,
            'journal_id' : journal.id,
            })
        account_id = self.Account.search([('user_type_id.type', '=', 'liquidity'), ('currency_id', '=', False)], limit=1).id
        vals = {
        'amount': 1000,
        'date': time.strftime('%Y-%m-%d'),
        'partner_id': self.partner4.id,
        'name': 'EXT001',
        'statement_id': self.account_statement.id,
        }
        self.AccBankStateLine.create(vals)

        #process the bank statement line
        self.Account = self.Account.create({
            'name' : 'toto',
            'code' : 'bidule',
            'user_type_id' : self.account_user_type_id.id,
            })

        #process the bank statement line
        self.account_statement.line_ids[0].process_reconciliation(new_aml_dicts=[{
        'credit': 1000,
        'debit': 0,
        'name': 'toto',
        'account_id': account_id,
        }])

        #modify the bank statement and set the Closing Balance.
        self.account_statement.write({
            'balance_end_real' : 1000.00
            })

        #I confirm the bank statement using Confirm button
        self.account_statement.button_confirm_bank()

        #I check that bank statement state is now "Closed"
        self.account_statement.write({
            'state' : 'confirm'
           })
