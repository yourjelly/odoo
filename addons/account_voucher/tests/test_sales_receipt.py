# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.account_voucher.tests.common import TestAccountVoucherCommon
import time

class TestSaleReceipt(TestAccountVoucherCommon):

    def test_00_sale_receipt_flow(self):
        """ Create Sale Receipt for Account Voucher"""
        self.partner_id = self.ref('base.res_partner_2')
        self.account_voucher_seagate_0 = self.Voucher.sudo(self.res_users_account_voucher_user).create({
            'account_id': self.account_receivable.id,
            'amount': 30000.0,
            'company_id': self.company_id.id,
            'journal_id': self.sales_journal.id,
            'line_ids': [
            (0, 0, {
                'account_id': self.account_sale.id,
                'price_unit': 30000.0,
                'name': 'Voucher Seagate',
                })],
            'partner_id': self.partner_id,
            'date': time.strftime('%Y-%m-%d'),
            'voucher_type': 'sale'
            })
        # AccountVoucher(account_voucher_seagate_0) stage should be in 'draft' stage
        self.assertEquals(self.account_voucher_seagate_0.state, 'draft', 'Initially voucher should be in the "Draft" state')