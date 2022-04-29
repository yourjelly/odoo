# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests.common import HttpCase, new_test_user


class TestKnowledgeCommon(HttpCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.user_admin = new_test_user(cls.env, login='user_admin', email='user.admin@example.com', groups='base.group_user,base.group_system')
        cls.partner_admin = cls.user_admin.partner_id
        cls.user_demo = new_test_user(cls.env, login='user_demo', email='user.demo@example.com', groups='base.group_user')
        cls.partner_demo = cls.user_demo.partner_id
        cls.user_portal = new_test_user(cls.env, login='user_portal', email='user.portal@example.com', groups='base.group_portal')
        cls.partner_portal = cls.user_portal.partner_id
        cls.user_public = new_test_user(cls.env, login='user_public', groups='base.group_public')
        cls.partner_public = cls.user_public.partner_id
