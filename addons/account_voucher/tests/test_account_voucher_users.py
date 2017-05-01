# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.account_voucher.tests.common import TestAccountVoucherCommon

class TestAccountVoucherUsers(TestAccountVoucherCommon):

    def setUp(self):
        super(TestAccountVoucherUsers, self).setUp()

    def test_00_account_voucher_users_flow(self):
        self.res_users_account_voucher_manager = self.ResUsers.create({
            'company_id': self.company_id.id,
            'name': 'Financial Manager for voucher',
            'login': 'fmv',
            'email': 'finmanager@yourcompany.com',
            'groups_id': [(6, 0, [self.group_partner_manager_id.id, self.group_account_user_id.id])]
        })
