# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests.common import TransactionCase


class TestAccountVoucher(TransactionCase):

    def setUp(self):
        super(TestAccountVoucher, self).setUp()

        self.AccVoucher = self.env['account.voucher']
        self.company_id = self.ref('base.main_company')
        self.partner_id = self.ref('base.res_partner_12')

        self.account_voucher_voucherforaxelor0 = self.AccVoucher.with_context({'res_users_account_voucher_user': True}).create({
+           'voucher_type': 'sale',
+           'account_id': 'a_cash',
			'amount': 1000.0,
+           'company_id': self.company_id,
+           'journal_id': 'sales_journal',
			'name': 'Voucher for Axelor',
			'narration': 'Basic Pc',
			'line_ids': [
                (0, 0, {	
                    'account_id': 'a_recv',
                    'price_unit': 1000.0,
                    'name': 'Voucher for Axelor',
                })]
			'partner_id': self.partner_id,
			'date': ,
			'reference': 'none'
+       })

        self.assertEquals(self.account_voucher_voucherforaxelor0.state, 'draft', 'Initially customer voucher should be in the "Draft" state')

        self.account_voucher_voucheraxelor0 = self.AccVoucher.create({
+       	'voucher_type': 'purchase',
+           'account_id': 'a_cash',
			'amount': 1000.0,
+           'company_id': self.company_id,
+           'journal_id': 'j_cash',
			'name': 'Voucher Axelor',
			'narration': 'PC Assemble SC234',
			'line_ids': [
                (0, 0, {
                    'account_id': 'a_cash',
                    'price_unit': 1000.0,
                    'name': 'Voucher Axelor',
                })],
			'partner_id': self.partner_id,
			'date': ,
			'reference': 'none'
+       })

        self.assertEquals(self.account_voucher_voucheraxelor0.state, 'draft', 'Initially vendor voucher should be in the "Draft" state')
