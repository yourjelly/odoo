# -*- coding: utf-8 -*-
import openerp

class TestUserLogin(openerp.tests.common.TransactionCase):
    def test_user_login(self):
        res_users = self.env['res.users']
        main_partner_id = self.env.ref('base.main_partner')


        admin_fixed = res_users.create({
            'partner_id': main_partner_id.id,
            'login': ' Administrator ',
        })

        admin_good = res_users.create({
            'partner_id': main_partner_id.id,
            'login': 'Administrator',
        })

        self.assertEquals(admin_fixed.login, 'Administrator')
        self.assertEquals(admin_good.login, 'Administrator')
