
# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from functools import partial

from odoo.tests import common, new_test_user


mail_new_test_user = partial(new_test_user, context={'mail_create_nolog': True, 'mail_create_nosubscribe': True, 'mail_notrack': True, 'no_reset_password': True})


class TestMailTemplateSecurityCommon(common.TransactionCase):
    def setUp(self):
        super(TestMailTemplateSecurityCommon, self).setUp()

        self.user_employee = mail_new_test_user(self.env, login='employee', groups='base.group_user', signature='--\nErnest', name='Ernest Employee')
        self.user_admin = self.env.ref('base.user_admin')
