# -*- coding: utf-8 -*-
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

    def test_invoice_creation_with_manual_tax_amounts(self):
        tax_groups = self.env['account.tax.group'].create([
            {'name': "test_invoice_creation_with_manual_tax_amounts_1"},
            {'name': "test_invoice_creation_with_manual_tax_amounts_2"},
        ])
        taxes = self.env['account.tax'].create([
            {'name': "10%", 'amount_type': 'percent', 'amount': 10.0, 'tax_group_id': tax_groups[0].id},
            {'name': "20%", 'amount_type': 'percent', 'amount': 20.0, 'tax_group_id': tax_groups[1].id},
        ])

        # Create a new invoice.
        invoice_form = Form(self.env['account.move'].with_context(default_move_type='out_invoice'))
        invoice_form._view['modifiers']['tax_totals']['readonly'] = 'False'
        invoice_form.invoice_date = fields.Date.from_string('2020-01-01')
        invoice_form.partner_id = self.partner_a
        with invoice_form.invoice_line_ids.new() as line_form:
            line_form.price_unit = 100
            line_form.tax_ids.clear()
            line_form.tax_ids.add(taxes[0])
        with invoice_form.invoice_line_ids.new() as line_form:
            line_form.price_unit = 200
            line_form.tax_ids.clear()
            line_form.tax_ids.add(taxes[1])

        # Edit the tax amounts.
        tax_totals = invoice_form.tax_totals
        tax_totals['changed_tax_group_id'] = tax_groups[0].id
        tax_totals['delta_amount_currency'] = 10.0
        invoice_form.tax_totals = tax_totals

        self.assertEqual(invoice_form.tax_totals_manual_amounts, {str(taxes[0].id): 20.0})

        tax_totals = invoice_form.tax_totals
        tax_totals['changed_tax_group_id'] = tax_groups[1].id
        tax_totals['delta_amount_currency'] = 10.0
        invoice_form.tax_totals = tax_totals

        self.assertEqual(invoice_form.tax_totals_manual_amounts, {str(taxes[0].id): 20.0, str(taxes[1].id): 50.0})

        invoice = invoice_form.save()

        self.assertRecordValues(invoice, [{
            'amount_untaxed': 300.0,
            'amount_tax': 70.0,
            'amount_total': 370.0,
        }])

        # Modify the invoice from 'line_ids'.
        # Ensure the first manual tax amount has not been lost in the process.
        tax_line = invoice.line_ids.filtered(lambda line: line.tax_line_id.amount == 20.0)
        term_line = invoice.line_ids.filtered(lambda line: line.display_type == 'payment_term')
        invoice.line_ids = [
            Command.update(tax_line.id, {'amount_currency': -60.0}),
            Command.update(term_line.id, {'amount_currency': 380.0}),
        ]

        self.assertRecordValues(invoice, [{
            'amount_untaxed': 300.0,
            'amount_tax': 80.0,
            'amount_total': 380.0,
        }])

        # Change the price_unit of a base line.
        # The manual tax amounts are lost.
        base_line = invoice.line_ids.filtered(lambda line: line.tax_ids == taxes[0])
        base_line.price_unit = 200

        self.assertRecordValues(invoice, [{
            'amount_untaxed': 400.0,
            'amount_tax': 60.0,
            'amount_total': 460.0,
        }])

        # Edit the tax amounts on the form again but the invoice is already stored this time.
        with Form(invoice) as invoice_form:
            invoice_form._view['modifiers']['tax_totals']['readonly'] = 'False'
            tax_totals = invoice_form.tax_totals
            tax_totals['changed_tax_group_id'] = tax_groups[0].id
            tax_totals['delta_amount_currency'] = -10.0
            invoice_form.tax_totals = tax_totals

        self.assertRecordValues(invoice, [{
            'amount_untaxed': 400.0,
            'amount_tax': 50.0,
            'amount_total': 450.0,
        }])
