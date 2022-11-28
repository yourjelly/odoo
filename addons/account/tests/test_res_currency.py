# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo.exceptions import UserError
from odoo.tests.common import TransactionCase
from odoo.tests import tagged

from odoo.addons.account.tests.common import AccountTestInvoicingCommon

@tagged('post_install', '-at_install')
class TestResCurrency(AccountTestInvoicingCommon):
    def test_res_currency_archive(self):
        currency_foo = self.env['res.currency'].create({'name': 'foo', 'symbol': '##', 'active': False})
        currency_bar = self.env['res.currency'].create({'name': 'bar', 'symbol': '**', 'active': False})
        currency_baz = self.env['res.currency'].create({'name': 'baz', 'symbol': '@@', 'active': False})

        self.assertFalse(currency_foo.active)
        self.assertFalse(currency_bar.active)
        self.assertFalse(currency_baz.active)

        company_foo = self.company_data['company']

        # Assigning a currency to a company must automatically unarchive the currency
        company_foo.currency_id = currency_foo
        self.assertTrue(currency_foo.active)

        # Assigning a new currency to a company must automatically archive the former currency
        # if it is not used by another company and it has no accounting entries
        company_foo.currency_id = currency_bar
        self.assertFalse(currency_foo.active)
        self.assertTrue(currency_bar.active)

        # Resetting the foo currency to the foo company for more clarity
        company_foo.currency_id = currency_foo

        # Enable both foo and bar currencies, because we will use both in the following move
        currency_bar.active = True
        self.assertTrue(currency_foo.active)
        self.assertTrue(currency_bar.active)

        # Create an entry using the currency bar for the company foo, using the currency foo, which means:
        # - the currency of the move will be bar
        # - the company currency of the move will be foo
        move = self.env['account.move'].create({
            'move_type': 'entry',
            'currency_id': currency_bar.id,
            'journal_id': self.company_data['default_journal_misc'].id,
            'line_ids': [
                (0, 0, {'debit': 100.0, 'credit': 0.0,   'currency_id': currency_bar.id, 'account_id': self.company_data['default_account_receivable'].id}),
                (0, 0, {'debit': 0.0,   'credit': 100.0, 'currency_id': currency_bar.id, 'account_id': self.company_data['default_account_revenue'].id}),
            ],
        })
        self.assertEqual(move.line_ids.currency_id, currency_bar)
        self.assertEqual(move.line_ids.company_currency_id, currency_foo)
        # Now, both currency foo and currency bar have accounting entries.
        # Only currency baz doesn't have accounting entries

        # Changing the currency of the company foo must now be prevented because it has an accounting entry
        with self.assertRaises(UserError):
            company_foo.currency_id = currency_bar

        # Changing the currency of a company must automatically unarchive the new currency
        # and archive the former currency if it doesn't have accounting entries
        company_baz = self.env['res.company'].create({'name': 'bar', 'currency_id': currency_baz.id})
        self.assertTrue(currency_baz.active)
        company_baz.currency_id = currency_bar
        self.assertFalse(currency_baz.active)

        # Changing the currency of a company must automatically unarchive the new currency
        # and not archive the former currency if it has accounting entries
        company_baz.currency_id = currency_baz
        self.assertTrue(currency_baz.active)
        self.assertTrue(currency_bar.active)
