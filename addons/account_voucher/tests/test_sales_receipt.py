# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests.common import TransactionCase


class TestSaleReceipt(TransactionCase):

    def setUp(self):
        super(TestSaleReceipt, self).setUp()

        self.AccVoucher = self.env['account.voucher']
        self.company_id = self.ref('base.main_company')
        self.partner_id = self.ref('base.res_partner_2')

        self.account_voucher_seagate_0 = self.AccVoucher.with_context({'res_users_account_voucher_user': True}).create({
+           'account_id': 'a_recv',
			'amount': 30000.0,
+           'company_id': self.company_id,
+           'journal_id': 'sales_journal',
			'line_ids': [
                (0, 0, {	
                    'account_id': 'a_sale',
                    'price_unit': 30000.0,
                    'name': 'Voucher Seagate',
                })]
			'partner_id': self.partner_id,
			'date': ,
			'voucher_type': 'sale'
        })

        self.assertEquals(self.account_voucher_seagate_0.state, 'draft', 'Initially voucher should be in the "Draft" state')