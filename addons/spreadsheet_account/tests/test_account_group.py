# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo.addons.account.tests.common import AccountTestInvoicingCommon
from odoo.tests import tagged
from odoo import Command


@tagged('post_install', '-at_install')
class SpreadsheetAccountGroupTest(AccountTestInvoicingCommon):

    def test_fetch_account_no_group(self):
        self.assertEqual(self.env["account.account"].get_account_group([]), [])

    def test_fetch_account_one_group(self):
        self.assertEqual(self.env["account.account"].get_account_group([{'account_type': 'income_other'}]), [['450000']])

    def test_group_with_no_account(self):
        self.env['account.account']\
            .search([('account_type', '=', 'income_other'), ('company_ids', '=', self.env.company.id)])\
            .unlink()
        self.assertEqual(self.env["account.account"].get_account_group([{'account_type': 'income_other'}]), [[]])

    def test_with_wrong_account_type_id(self):
        self.assertEqual(self.env["account.account"].get_account_group([{'account_type': 999999}]), [[]])

    def test_group_with_multiple_accounts(self):
        self.env['account.account'].create({
            'name': "test_group_with_multiple_accounts 1",
            'account_type': 'income_other',
            'code': '123',
        })
        self.env['account.account'].create({
            'name': "test_group_with_multiple_accounts 2",
            'account_type': 'income_other',
            'code': '789',
        })

        self.assertEqual(
            [sorted(x) for x in self.env['account.account'].get_account_group([{'account_type': 'income_other'}])],
            [['123', '450000', '789']],
        )

    def test_group_with_company(self):
        company_1_id = self.company_data["company"].id
        company_2_id = self.setup_other_company()["company"].id
        self.env['account.account'].create({
            'name': "test_group_with_multiple_accounts 1",
            'account_type': 'income_other',
            'code': '123',
            'company_ids': [Command.link(company_1_id)],
        })
        self.env['account.account'].create({
            'name': "test_group_with_multiple_accounts 2",
            'account_type': 'income_other',
            'code': '789',
            'company_ids': [Command.link(company_2_id)],
        })

        self.assertEqual(
            self.env['account.account'].get_account_group([
                {'account_type': 'income_other', 'company_id': company_1_id},
                {'account_type': 'income_other', 'company_id': company_2_id},
            ]),
            [['123', '450000'], ['450000', '789']],
        )
        companies = (company_1_id, company_2_id)
        self.assertEqual(
            self.env['account.account'].with_context(allowed_company_ids=companies).get_account_group([
                {'account_type': 'income_other'},
            ]),
            [['123', '450000', '789']],
        )

    def test_response_is_ordered(self):
        o1_codes_1, o1_codes_2 = self.env["account.account"].get_account_group(
            [{'account_type': "income"}, {'account_type': "income_other"}]
        )
        o2_codes_2, o2_codes_1 = self.env["account.account"].get_account_group(
            [{'account_type': "income_other"}, {'account_type': "income"}]
        )
        self.assertEqual(o1_codes_1, o2_codes_1)
        self.assertEqual(o1_codes_2, o2_codes_2)
