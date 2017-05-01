# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import tools
from odoo.modules.module import get_resource_path
from odoo.tests import common
import time


class TestAccountVoucher(common.TransactionCase):

    def _load(self, module, *args):
        tools.convert_file(self.cr, 'account_voucher',
                           get_resource_path(module, *args),
                           {}, 'init', False, 'test', self.registry._assertion_report)

    def test_00_account_voucher_flow(self):
        """ Create Account Voucher for Customer and Vendor """
        self._load('account', 'test', 'account_minimal_test.xml')

        # Models
        self.ResUsers = self.env['res.users']
        self.Voucher = self.env['account.voucher']

        # User-groups and References
        self.group_partner_manager_id = self.env.ref('base.group_partner_manager')
        self.group_account_user_id = self.env.ref('account.group_account_user')
        self.company_id = self.env.ref('base.main_company')
        self.partner_id = self.env.ref('base.res_partner_12')

        # Create a Account Voucher User
        self.res_users_account_voucher_user = self.ResUsers.create({
            'name': 'Voucher Accountant',
            'login': 'vacc',
            'password': 'vacc',
            'email': 'accountant@yourcompany.com',
            'company_id': self.company_id.id,
            'groups_id': [(6, 0, [self.group_partner_manager_id.id, self.group_account_user_id.id])]
            })

        # Create Customer Voucher
        self.account_voucher_voucherforaxelor0 = self.Voucher.sudo(self.res_users_account_voucher_user).create({
            'voucher_type': 'sale',
            'partner_id': self.partner_id.id,
            'company_id': self.company_id.id,
            'account_id': self.env.ref('account_voucher.cash').id,
            'journal_id': self.env.ref('account_voucher.sales_journal').id,
            'date': time.strftime('%Y-%m-%d'),
            'name': 'Voucher for Axelor',
            'amount': 1000.0,
            'narration': 'Basic Pc',
            'reference': 'none',
            'line_ids': [
                (0, 0, {
                    'account_id': self.env.ref('account_voucher.a_recv').id,
                    'price_unit': 1000.0,
                    'name': 'Voucher for Axelor',
                    })]
        })
        # Check Customer Voucher status.
        self.assertEquals(self.account_voucher_voucherforaxelor0.state, 'draft', 'Initially customer voucher should be in the "Draft" state')

        # Validate Customer voucher
        self.account_voucher_voucherforaxelor0.proforma_voucher()
        # Check for Journal Entry of customer voucher
        self.assertTrue(self.account_voucher_voucherforaxelor0.move_id, 'Journal Entry should be posted')
        # Find related account move line for Customer Voucher.
        customer_voucher_move_line = self.account_voucher_voucherforaxelor0.move_id

        # Check state of Account move line.
        self.assertEquals(customer_voucher_move_line.state, 'posted', 'Account move state is incorrect.')
        # Check partner of Account move line.
        self.assertEquals(customer_voucher_move_line.partner_id, self.partner_id, 'Partner is incorrect.')
        # Check company of Account move line.
        self.assertEquals(customer_voucher_move_line.company_id, self.company_id, 'Company is incorrect.')
        # Check journal in Account move line.
        self.assertEquals(customer_voucher_move_line.journal_id, self.env.ref('account_voucher.sales_journal'), 'Journal is incorrect.')
        # Check amount in Account move line.
        self.assertEquals(customer_voucher_move_line.amount, 1000.0, 'Amount is incorrect.')
        # Check narration in Account move line.
        self.assertEquals(customer_voucher_move_line.narration, 'Basic Pc', 'Narration is incorrect.')

        # Create Vendor Voucher
        self.account_voucher_voucheraxelor0 = self.Voucher.sudo(self.res_users_account_voucher_user).create({
            'voucher_type': 'purchase',
            'partner_id': self.partner_id.id,
            'company_id': self.company_id.id,
            'account_id': self.env.ref('account_voucher.cash').id,
            'journal_id': self.env.ref('account_voucher.cash_journal').id,
            'date': time.strftime('%Y-%m-%d'),
            'name': 'Voucher Axelor',
            'amount': 1000.0,
            'narration': 'PC Assemble SC234',
            'reference': 'none',
            'line_ids': [
                (0, 0, {
                    'account_id': self.env.ref('account_voucher.a_recv').id,
                    'price_unit': 1000.0,
                    'name': 'Voucher Axelor',
                    })]
        })
        # Check Vendor Voucher status.
        self.assertEquals(self.account_voucher_voucheraxelor0.state, 'draft', 'Initially vendor voucher should be in the "Draft" state')

        # Validate Vendor voucher
        self.account_voucher_voucheraxelor0.proforma_voucher()
        # Check for Journal Entry of customer voucher
        self.assertTrue(self.account_voucher_voucheraxelor0.move_id, 'Journal Entry should be posted')
        # Find related account move line for Vendor Voucher.
        vendor_voucher_move_line = self.account_voucher_voucheraxelor0.move_id

        # Check state of Account move line.
        self.assertEquals(vendor_voucher_move_line.state, 'posted', 'Account move state is incorrect.')
        # Check partner of Account move line.
        self.assertEquals(vendor_voucher_move_line.partner_id, self.partner_id, 'Partner is incorrect.')
        # Check company of Account move line.
        self.assertEquals(vendor_voucher_move_line.company_id, self.company_id, 'Company is incorrect.')
        # Check journal in Account move line.
        self.assertEquals(vendor_voucher_move_line.journal_id, self.env.ref('account_voucher.cash_journal'), 'Journal is incorrect.')
        # Check amount in Account move line.
        self.assertEquals(vendor_voucher_move_line.amount, 1000.0, 'Amount is incorrect.')
        # Check narration in Account move line.
        self.assertEquals(vendor_voucher_move_line.narration, 'PC Assemble SC234', 'Narration is incorrect.')
