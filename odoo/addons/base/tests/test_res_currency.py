# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo.exceptions import UserError
from odoo.tests.common import TransactionCase


class TestResCurrency(TransactionCase):
    def test_res_currency_archive(self):
        currency_foo = self.env['res.currency'].create({'name': 'foo', 'symbol': '##', 'active': False})
        currency_bar = self.env['res.currency'].create({'name': 'bar', 'symbol': '**', 'active': False})

        self.assertFalse(currency_foo.active)
        self.assertFalse(currency_bar.active)

        # Creating a new company with an archived currency must automatically unarchive the currency
        company_foo = self.env['res.company'].create({'name': 'foo', 'currency_id': currency_foo.id})
        self.assertTrue(currency_foo.active)

        # Allow to unarchive and archive a unused currency at your will
        currency_bar.active = True
        self.assertTrue(currency_bar.active)
        currency_bar.active = False
        self.assertFalse(currency_bar.active)

        # Attempting to disable a currency assigned to an active company must raise an exception
        with self.assertRaises(UserError):
            currency_foo.active = False

        # Changing the currency of a company must automatically unarchive the new currency
        # and archive the former currency if unused
        company_foo.currency_id = currency_bar
        self.assertTrue(currency_bar.active)
        self.assertFalse(currency_foo.active)

        # Changing the currency of a company must automatically unarchive the new currency
        # but not archive the former currency if it is used by another company
        company_bar = self.env['res.company'].create({'name': 'bar', 'currency_id': currency_bar.id})
        company_foo.currency_id = currency_foo
        self.assertTrue(currency_foo.active)
        self.assertTrue(currency_bar.active)
