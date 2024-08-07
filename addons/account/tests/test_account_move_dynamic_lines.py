# -*- coding: utf-8 -*-
from freezegun import freeze_time

from odoo.addons.account.tests.common import AccountTestInvoicingCommon
from odoo.tests import Form, tagged
from odoo import fields, Command


@tagged('post_install', '-at_install')
class TestAccountMoveDynamicLines(AccountTestInvoicingCommon):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        cls.other_currency = cls.setup_other_currency('HRK', rounding=0.001)

    def test_invoice_sync_accounting_amounts(self):
        invoice = self.env['account.move'].create({
            'move_type': 'out_invoice',
            'invoice_date': '2016-01-01',
            'partner_id': self.partner_a.id,
            'invoice_line_ids': [Command.create({'product_id': self.product_a.id})],
        })
        self.assertRecordValues(invoice.line_ids.sorted(), [
            {'display_type': 'product',         'amount_currency': -1000.0,     'balance': -1000.0, 'debit': 0.0,       'credit': 1000.0},
            {'display_type': 'tax',             'amount_currency': -150.0,      'balance': -150.0,  'debit': 0.0,       'credit': 150.0},
            {'display_type': 'payment_term',    'amount_currency': 1150.0,      'balance': 1150.0,  'debit': 1150.0,    'credit': 0.0},
        ])

        # Manual edition of the tax line.
        # The balance should be recomputed, same for debit/credit.
        invoice.line_ids.filtered(lambda line: line.display_type == 'tax').amount_currency = -160
        self.assertRecordValues(invoice.line_ids.sorted(), [
            {'display_type': 'product',         'amount_currency': -1000.0,     'balance': -1000.0, 'debit': 0.0,       'credit': 1000.0},
            {'display_type': 'tax',             'amount_currency': -160.0,      'balance': -160.0,  'debit': 0.0,       'credit': 160.0},
            {'display_type': 'payment_term',    'amount_currency': 1160.0,      'balance': 1160.0,  'debit': 1160.0,    'credit': 0.0},
        ])
        invoice.line_ids.filtered(lambda line: line.display_type == 'tax').balance = -170
        self.assertRecordValues(invoice.line_ids.sorted(), [
            {'display_type': 'product',         'amount_currency': -1000.0,     'balance': -1000.0, 'debit': 0.0,       'credit': 1000.0},
            {'display_type': 'tax',             'amount_currency': -170.0,      'balance': -170.0,  'debit': 0.0,       'credit': 170.0},
            {'display_type': 'payment_term',    'amount_currency': 1170.0,      'balance': 1170.0,  'debit': 1170.0,    'credit': 0.0},
        ])
        invoice.line_ids.filtered(lambda line: line.display_type == 'tax').debit = 170
        self.assertRecordValues(invoice.line_ids.sorted(), [
            {'display_type': 'product',         'amount_currency': -1000.0,     'balance': -1000.0, 'debit': 0.0,       'credit': 1000.0},
            {'display_type': 'tax',             'amount_currency': 170.0,       'balance': 170.0,   'debit': 170.0,     'credit': 0.0},
            {'display_type': 'payment_term',    'amount_currency': 830.0,       'balance': 830.0,   'debit': 830.0,     'credit': 0.0},
        ])

        # Change the currency.
        # The manual tax amount is lost.
        invoice.currency_id = self.other_currency
        self.assertRecordValues(invoice.line_ids.sorted(), [
            {'display_type': 'product',         'amount_currency': -1000.0,     'balance': -333.33,     'debit': 0.0,       'credit': 333.33},
            {'display_type': 'tax',             'amount_currency': -150.0,      'balance': -50.0,       'debit': 0.0,       'credit': 50.0},
            {'display_type': 'payment_term',    'amount_currency': 1150.0,      'balance': 383.33,      'debit': 383.33,    'credit': 0.0},
        ])

        # Change the accounting amount of the product line.
        # We don't expect the price_unit to be recomputed so the taxes remain the same as before.
        invoice.line_ids.filtered(lambda line: line.display_type == 'product').amount_currency = -1200
        self.assertRecordValues(invoice.line_ids.sorted(), [
            {'display_type': 'product',         'price_unit': 1000.0,   'amount_currency': -1200.0,     'balance': -400.0,      'debit': 0.0,       'credit': 400.0},
            {'display_type': 'tax',             'price_unit': 0.0,      'amount_currency': -150.0,      'balance': -50.0,       'debit': 0.0,       'credit': 50.0},
            {'display_type': 'payment_term',    'price_unit': 0.0,      'amount_currency': 1350.0,      'balance': 450.0,       'debit': 450.0,     'credit': 0.0},
        ])

        # Change the price unit.
        invoice.line_ids.filtered(lambda line: line.display_type == 'product').price_unit = 3000
        self.assertRecordValues(invoice.line_ids.sorted(), [
            {'display_type': 'product',         'price_unit': 3000.0,   'amount_currency': -3000.0,     'balance': -1000.0,     'debit': 0.0,       'credit': 1000.0},
            {'display_type': 'tax',             'price_unit': 0.0,      'amount_currency': -450.0,      'balance': -150.0,      'debit': 0.0,       'credit': 150.0},
            {'display_type': 'payment_term',    'price_unit': 0.0,      'amount_currency': 3450.0,      'balance': 1150.0,      'debit': 1150.0,    'credit': 0.0},
        ])

        # Change a tax line, then the date.
        tax_line = invoice.line_ids.filtered(lambda line: line.display_type == 'tax')
        tax_line.amount_currency = -500.0
        tax_line.name = "turlututu"
        invoice.invoice_date = '2017-01-01'
        self.assertRecordValues(invoice.line_ids.sorted(), [
            {'display_type': 'product',         'price_unit': 3000.0,   'amount_currency': -3000.0,     'balance': -1500.0,     'debit': 0.0,       'credit': 1500.0},
            {'display_type': 'tax',             'price_unit': 0.0,      'amount_currency': -500.0,      'balance': -250.0,      'debit': 0.0,       'credit': 250.0},
            {'display_type': 'payment_term',    'price_unit': 0.0,      'amount_currency': 3500.0,      'balance': 1750.0,      'debit': 1750.0,    'credit': 0.0},
        ])
        self.assertRecordValues(tax_line, [{'name': "turlututu"}])

        # Changing the name of a payment term line should be allowed as well without recomputing anything else.
        term_line = invoice.line_ids.filtered(lambda line: line.display_type == 'payment_term')
        term_line.name = "tsoin tsoin"
        self.assertRecordValues(invoice.line_ids.sorted(), [
            {'display_type': 'product',         'price_unit': 3000.0,   'amount_currency': -3000.0,     'balance': -1500.0,     'debit': 0.0,       'credit': 1500.0},
            {'display_type': 'tax',             'price_unit': 0.0,      'amount_currency': -500.0,      'balance': -250.0,      'debit': 0.0,       'credit': 250.0},
            {'display_type': 'payment_term',    'price_unit': 0.0,      'amount_currency': 3500.0,      'balance': 1750.0,      'debit': 1750.0,    'credit': 0.0},
        ])
        self.assertRecordValues(term_line, [{'name': "tsoin tsoin"}])

        # Add a new invoice line without passing from the move.
        self.env['account.move.line'].create({'product_id': self.product_a.id, 'move_id': invoice.id})
        self.assertRecordValues(invoice.line_ids.sorted(), [
            {'display_type': 'product',         'price_unit': 3000.0,   'amount_currency': -3000.0,     'balance': -1500.0,     'debit': 0.0,       'credit': 1500.0},
            {'display_type': 'tax',             'price_unit': 0.0,      'amount_currency': -750.0,      'balance': -375.0,      'debit': 0.0,       'credit': 375.0},
            {'display_type': 'payment_term',    'price_unit': 0.0,      'amount_currency': 5750.0,      'balance': 2875.0,      'debit': 2875.0,    'credit': 0.0},
            {'display_type': 'product',         'price_unit': 2000.0,   'amount_currency': -2000.0,     'balance': -1000.0,     'debit': 0.0,       'credit': 1000.0},
        ])

        # Edit the move but keep it balanced.
        # The 'old' reference to tax_line/term_line should work here because we have only updated them so far.
        invoice.line_ids = [
            Command.update(tax_line.id, {'balance': -400.0}),
            Command.update(term_line.id, {'balance': 2900.0}),
        ]
        self.assertRecordValues(invoice.line_ids.sorted(), [
            {'display_type': 'product',         'price_unit': 3000.0,   'amount_currency': -3000.0,     'balance': -1500.0,     'debit': 0.0,       'credit': 1500.0},
            {'display_type': 'tax',             'price_unit': 0.0,      'amount_currency': -750.0,      'balance': -400.0,      'debit': 0.0,       'credit': 400.0},
            {'display_type': 'payment_term',    'price_unit': 0.0,      'amount_currency': 5750.0,      'balance': 2900.0,      'debit': 2900.0,    'credit': 0.0},
            {'display_type': 'product',         'price_unit': 2000.0,   'amount_currency': -2000.0,     'balance': -1000.0,     'debit': 0.0,       'credit': 1000.0},
        ])
        self.assertRecordValues(tax_line + term_line, [
            {'name': "turlututu"},
            {'name': "tsoin tsoin"},
        ])

        # Remove the lines.
        invoice.line_ids.sorted()[0].unlink()
        self.assertRecordValues(invoice.line_ids.sorted(), [
            {'display_type': 'tax',             'price_unit': 0.0,      'amount_currency': -300.0,      'balance': -150.0,      'debit': 0.0,       'credit': 150.0},
            {'display_type': 'payment_term',    'price_unit': 0.0,      'amount_currency': 2300.0,      'balance': 1150.0,      'debit': 1150.0,    'credit': 0.0},
            {'display_type': 'product',         'price_unit': 2000.0,   'amount_currency': -2000.0,     'balance': -1000.0,     'debit': 0.0,       'credit': 1000.0},
        ])
        invoice.line_ids.sorted()[2].unlink()
        self.assertRecordValues(invoice.line_ids, [])

    def test_invoice_date_set_at_post(self):
        with freeze_time('2016-01-01'):
            invoice = self.env['account.move'].create({
                'move_type': 'out_invoice',
                'partner_id': self.partner_a.id,
                'currency_id': self.other_currency.id,
                'invoice_payment_term_id': self.term_advance_60days.id,
                'invoice_line_ids': [Command.create({'product_id': self.product_a.id})],
            })

            # Customize a tax amount using 'tax_totals'.
            tax_line = invoice.line_ids.filtered(lambda line: line.display_type == 'tax')
            tax_line.amount_currency = -462.0
            self.assertRecordValues(invoice.line_ids.sorted(), [
                {'display_type': 'product',         'price_unit': 3000.0,   'amount_currency': -3000.0,     'balance': -1000.0,     'debit': 0.0,       'credit': 1000.0},
                {'display_type': 'tax',             'price_unit': 0.0,      'amount_currency': -462.0,      'balance': -154.0,      'debit': 0.0,       'credit': 154.0},
                {'display_type': 'payment_term',    'price_unit': 0.0,      'amount_currency': 1038.6,      'balance': 346.2,       'debit': 346.2,     'credit': 0.0},
                {'display_type': 'payment_term',    'price_unit': 0.0,      'amount_currency': 2423.4,      'balance': 807.8,       'debit': 807.8,     'credit': 0.0},
            ])

        with freeze_time('2017-01-01'):
            invoice.payment_reference = "turlututu"
            invoice.action_post()
            self.assertRecordValues(invoice.line_ids.sorted(), [
                {'display_type': 'product',         'price_unit': 3000.0,   'amount_currency': -3000.0,     'balance': -1500.0,     'debit': 0.0,       'credit': 1500.0},
                {'display_type': 'tax',             'price_unit': 0.0,      'amount_currency': -462.0,      'balance': -231.0,      'debit': 0.0,       'credit': 231.0},
                {'display_type': 'payment_term',    'price_unit': 0.0,      'amount_currency': 1038.6,      'balance': 519.3,       'debit': 519.3,     'credit': 0.0},
                {'display_type': 'payment_term',    'price_unit': 0.0,      'amount_currency': 2423.4,      'balance': 1211.7,      'debit': 1211.7,    'credit': 0.0},
            ])
            term_lines = invoice.line_ids.filtered(lambda line: line.display_type == 'payment_term')
            self.assertRecordValues(term_lines, [
                {'name': "turlututu installment #1",    'date_maturity': fields.Date.from_string('2017-01-01')},
                {'name': "turlututu installment #2",    'date_maturity': fields.Date.from_string('2017-03-02')},
            ])

    def test_invoice_sync_payment_terms(self):
        invoice = self.env['account.move'].create({
            'name': "",
            'move_type': 'out_invoice',
            'invoice_date': '2017-01-01',
            'partner_id': self.partner_a.id,
            'currency_id': self.other_currency.id,
            'invoice_payment_term_id': self.term_immediate.id,
            'invoice_line_ids': [Command.create({'product_id': self.product_a.id})],
        })
        self.assertRecordValues(invoice, [{'invoice_date_due': fields.Date.from_string('2017-01-01')}])

        # Change the payment term to 30% now, 70% later.
        # The tax lines remains untouched if a manual edition has been made.
        tax_line = invoice.line_ids.filtered(lambda line: line.display_type == 'tax')
        tax_line.balance = -160.0
        invoice.invoice_payment_term_id = self.term_advance_60days
        expected_values = [
            {'display_type': 'product',         'price_unit': 2000.0,   'amount_currency': -2000.0,     'balance': -1000.0,     'debit': 0.0,       'credit': 1000.0},
            {'display_type': 'payment_term',    'price_unit': 0.0,      'amount_currency': 690.0,       'balance': 348.0,       'debit': 348.0,     'credit': 0.0},
            {'display_type': 'tax',             'price_unit': 0.0,      'amount_currency': -300.0,      'balance': -160.0,      'debit': 0.0,       'credit': 160.0},
            {'display_type': 'payment_term',    'price_unit': 0.0,      'amount_currency': 1610.0,      'balance': 812.0,       'debit': 812.0,     'credit': 0.0},
        ]
        self.assertRecordValues(invoice.line_ids.sorted(), expected_values)
        self.assertRecordValues(invoice, [{'invoice_date_due': fields.Date.from_string('2017-03-02')}])

        # Customize the term lines.
        term_lines = invoice.line_ids.filtered(lambda line: line.display_type == 'payment_term')
        self.assertRecordValues(term_lines, [
            {'name': "installment #1",      'date_maturity': fields.Date.from_string('2017-01-01')},
            {'name': "installment #2",      'date_maturity': fields.Date.from_string('2017-03-02')},
        ])
        term_lines[0].name = "pay me asap plz!"
        self.assertRecordValues(term_lines, [
            {'name': "pay me asap plz!",    'date_maturity': fields.Date.from_string('2017-01-01')},
            {'name': "installment #2",      'date_maturity': fields.Date.from_string('2017-03-02')},
        ])

        # Post: you lost everything.
        invoice.action_post()
        self.assertRecordValues(invoice.line_ids.sorted(), expected_values)
        self.assertRecordValues(term_lines, [
            {'name': f"{invoice.name} installment #1",      'date_maturity': fields.Date.from_string('2017-01-01')},
            {'name': f"{invoice.name} installment #2",      'date_maturity': fields.Date.from_string('2017-03-02')},
        ])

        # Resetting draft
        invoice.button_draft()
        self.assertRecordValues(invoice.line_ids.sorted(), expected_values)
        self.assertRecordValues(term_lines, [
            {'name': f"{invoice.name} installment #1",      'date_maturity': fields.Date.from_string('2017-01-01')},
            {'name': f"{invoice.name} installment #2",      'date_maturity': fields.Date.from_string('2017-03-02')},
        ])

        # Remove everything. The due date doesn't change.
        invoice.line_ids.sorted()[0].unlink()
        self.assertRecordValues(invoice.line_ids, [])
        self.assertRecordValues(invoice, [{'invoice_date_due': fields.Date.from_string('2017-03-02')}])
