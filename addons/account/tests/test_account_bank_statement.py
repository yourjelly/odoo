# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo.addons.account.tests.account_test_classes import AccountingTestCase


class TestAccountBankStatement(AccountingTestCase):

    def setUp(self):
        super(TestAccountBankStatement, self).setUp()
        # self.AccountVoucher = self.env['account.voucher']
        self.ResPartner = self.env['res.partner']
        self.AccountVoucher1 = self.env['account.voucher']
        # self.a_recv = self.ref('account.a_recv')
        print ">>>>>>>>>>>>>. aid", self.AccountVoucher1
        # self.account_voucher_seagate_0.create({

        #     })

    def test_000(self):
        print ">>>>>>>>>>>>>"

