# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.account_voucher.tests.common import TestAccountVoucherCommon
import time

class TestAccountVoucher(TestAccountVoucherCommon):

    def test_00_account_voucher_flow(self):
        """Create Account Voucher"""
        self.partner_id = self.ref('base.res_partner_12')

        self.account_voucher_voucherforaxelor0 = self.Voucher.sudo(self.res_users_account_voucher_user).create({
            'voucher_type': 'sale',
            'account_id': self.account_cash.id,
            'amount': 1000.0,
            'company_id': self.company_id.id,
            'journal_id': self.sales_journal.id,
            'name': 'Voucher for Axelor',
            'narration': 'Basic Pc',
            'line_ids': [
            (0, 0, {
                'account_id': self.account_receivable.id,
                'price_unit': 1000.0,
                'name': 'Voucher for Axelor',
                })],
            'partner_id': self.partner_id,
            'date': time.strftime('%Y-%m-%d'),
            'reference': 'none'
        })
        #AccountVoucher(account_voucher_voucherforaxelor0) stage should be in 'draft' stage
        self.assertEquals(self.account_voucher_voucherforaxelor0.state, 'draft', 'Initially customer voucher should be in the "Draft" state')

        self.account_voucher_voucheraxelor0 = self.Voucher.create({
            'voucher_type': 'purchase',
            'account_id': self.account_cash.id,
            'amount': 1000.0,
            'company_id': self.company_id.id,
            'journal_id': self.cash_journal.id,
            'name': 'Voucher Axelor',
            'narration': 'PC Assemble SC234',
            'line_ids': [
            (0, 0, {
                'account_id': self.account_cash.id,
                'price_unit': 1000.0,
                'name': 'Voucher Axelor',
                })],
            'partner_id': self.partner_id,
            'date': time.strftime('%Y-%m-%d'),
            'reference': 'none'
        })
        #AccountVoucher(account_voucher_voucherforaxelor0) stage should be in 'draft' stage
        self.assertEquals(self.account_voucher_voucheraxelor0.state, 'draft', 'Initially vendor voucher should be in the "Draft" state')
