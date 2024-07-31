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

    def test_turlututu(self):
        invoice = self.env['account.move'].create({
            'move_type': 'out_invoice',
            'partner_id': self.partner_a.id,
            'invoice_line_ids': [Command.create({'product_id': self.product_a.id})],
        })

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
