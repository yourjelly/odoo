# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests.common import TransactionCase, new_test_user

class TestKnowledgeCommon(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.user_admin = new_test_user(cls.env, login='user_admin', email='user.admin@mail.com', groups='base.group_system')
        cls.partner_admin = cls.user_admin.partner_id
        cls.user_demo = new_test_user(cls.env, login='user_demo', email='user.demo@mail.com', groups='base.group_user')
        cls.partner_demo = cls.user_demo.partner_id
        cls.user_public = new_test_user(cls.env, login='user_public', groups='base.group_public')
        cls.partner_public = cls.user_public.partner_id
