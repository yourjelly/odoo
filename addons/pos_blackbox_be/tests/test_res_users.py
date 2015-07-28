# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from openerp.tests import common

class TestResUsers(common.TransactionCase):
    def test_existence_of_insz_bis(self):
        demo_user = self.env['res.users'].search([('name', '=', 'Demo User')])
        self.assertTrue(hasattr(demo_user, 'insz_or_bis_number'))
