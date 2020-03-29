# -*- coding: utf-8 -*-
from odoo.addons.account.tests.common import AccountTestInvoicingCommon
from odoo.tests.common import Form
from odoo.tests import tagged
from odoo import fields


@tagged('post_install', '-at_install')
class TestAccountMoveTaxes(AccountTestInvoicingCommon):

    def _test_tax_armageddon_results(self, invoice):
        self.assertInvoiceValues(invoice, [
            {
                'product_id': self.product_a.id,
                'price_subtotal': 2000.0,
                'price_total': 2640.0,
                'tax_ids': self.tax_armageddon.ids,
                'tax_line_id': False,
                'currency_id': self.currency_data['currency'].id,
                'amount_currency': -2000.0,
                'debit': 0.0,
                'credit': 1000.0,
                'tax_exigible': False,
            },
            {
                'product_id': False,
                'price_subtotal': 0.0,
                'price_total': 0.0,
                'tax_ids': self.tax_armageddon.children_tax_ids[1].ids,
                'tax_line_id': self.tax_armageddon.children_tax_ids[0].id,
                'currency_id': self.currency_data['currency'].id,
                'amount_currency': -240.0,
                'debit': 0.0,
                'credit': 120.0,
                'tax_exigible': True,
            },
            {
                'product_id': False,
                'price_subtotal': 0.0,
                'price_total': 0.0,
                'tax_ids': self.tax_armageddon.children_tax_ids[1].ids,
                'tax_line_id': self.tax_armageddon.children_tax_ids[0].id,
                'currency_id': self.currency_data['currency'].id,
                'amount_currency': -160.0,
                'debit': 0.0,
                'credit': 80.0,
                'tax_exigible': True,
            },
            {
                'product_id': False,
                'price_subtotal': 0.0,
                'price_total': 0.0,
                'tax_ids': [],
                'tax_line_id': self.tax_armageddon.children_tax_ids[1].id,
                'currency_id': self.currency_data['currency'].id,
                'amount_currency': -240.0,
                'debit': 0.0,
                'credit': 120.0,
                'tax_exigible': False,
            },
            {
                'product_id': False,
                'price_subtotal': 0.0,
                'price_total': 0.0,
                'tax_ids': [],
                'tax_line_id': False,
                'currency_id': self.currency_data['currency'].id,
                'amount_currency': 2640.0,
                'debit': 1320.0,
                'credit': 0.0,
                'tax_exigible': True,
            },
        ], {
            'amount_untaxed': 2000.0,
            'amount_tax': 640.0,
            'amount_total': 2640.0,
        })

    def test_create_tax_armageddon(self):
        invoice = self.env['account.move'].create({
            'move_type': 'out_invoice',
            'partner_id': self.partner_a.id,
            'invoice_date': '2017-01-01',
            'currency_id': self.currency_data['currency'].id,
            'invoice_line_ids': [(0, 0, {
                'product_id': self.product_a.id,
                'price_unit': 2400.0,
                'tax_ids': [(6, 0, self.tax_armageddon.ids)],
            })],
        })

        self._test_tax_armageddon_results(invoice)

    def test_onchange_tax_armageddon(self):
        move_form = Form(self.env['account.move'].with_context(default_move_type='out_invoice'))
        move_form.partner_id = self.partner_a
        move_form.invoice_date = fields.Date.from_string('2017-01-01')
        move_form.currency_id = self.currency_data['currency']
        with move_form.invoice_line_ids.new() as line_form:
            line_form.product_id = self.product_a
            line_form.tax_ids.clear()
            line_form.tax_ids.add(self.tax_armageddon)
            line_form.price_unit = 2400.0
        invoice = move_form.save()

        self._test_tax_armageddon_results(invoice)

    def _test_invoice_manual_edition_of_taxes_single_currency(self, invoice):
        self.assertInvoiceValues(invoice, [
            {
                'product_id': self.product_a.id,
                'tax_ids': (self.tax_sale_a + self.tax_sale_b).ids,
                'tax_line_id': False,
                'debit': 0.0,
                'credit': 1000.0,
            },
            {
                'product_id': False,
                'tax_ids': [],
                'tax_line_id': self.tax_sale_a.id,
                'debit': 0.0,
                'credit': 160.0,
            },
            {
                'product_id': False,
                'tax_ids': [],
                'tax_line_id': self.tax_sale_b.id,
                'debit': 0.0,
                'credit': 140.0,
            },
            {
                'product_id': False,
                'tax_ids': [],
                'tax_line_id': False,
                'debit': 1300.0,
                'credit': 0.0,
            },
        ], {
            'amount_untaxed': 1000.0,
            'amount_tax': 300.0,
            'amount_total': 1300.0,
        })

    def test_invoice_create_manual_edition_of_taxes_single_currency(self):
        invoice = self.env['account.move'].create({
            'move_type': 'out_invoice',
            'partner_id': self.partner_a.id,
            'invoice_date': '2017-01-01',
            'invoice_line_ids': [(0, 0, {
                'product_id': self.product_a.id,
                'tax_ids': [(6, 0, (self.tax_sale_a + self.tax_sale_b).ids)],
            })],
        })

        tax_line_1 = invoice.line_ids.filtered(lambda line: line.tax_line_id == self.tax_sale_a)
        tax_line_2 = invoice.line_ids.filtered(lambda line: line.tax_line_id == self.tax_sale_b)
        invoice.write({
            'line_ids': [
                (1, tax_line_1.id, {'credit': tax_line_1.credit + 10.0}),
                (1, tax_line_2.id, {'credit': tax_line_2.credit - 10.0}),
            ],
        })

        self._test_manual_edition_of_taxes_single_currency(invoice)

        invoice.post()

        self._test_manual_edition_of_taxes_single_currency(invoice)

    def test_invoice_onchange_manual_edition_of_taxes_single_currency(self):
        move_form = Form(self.env['account.move'].with_context(default_move_type='out_invoice'))
        move_form.partner_id = self.partner_a
        move_form.invoice_date = fields.Date.from_string('2017-01-01')
        with move_form.invoice_line_ids.new() as line_form:
            line_form.product_id = self.product_a
            line_form.tax_ids.clear()
            line_form.tax_ids.add(self.tax_sale_a)
            line_form.tax_ids.add(self.tax_sale_b)
        invoice = move_form.save()

        tax_line_index_1 = [line.tax_line_id for line in invoice.line_ids].index(self.tax_sale_a)
        tax_line_index_2 = [line.tax_line_id for line in invoice.line_ids].index(self.tax_sale_b)
        with Form(invoice) as move_form:
            with move_form.line_ids.edit(tax_line_index_1) as line_form:
                line_form.credit += 10.0
            with move_form.line_ids.edit(tax_line_index_2) as line_form:
                line_form.credit -= 10.0

        self._test_manual_edition_of_taxes_single_currency(invoice)

        invoice.post()

        self._test_manual_edition_of_taxes_single_currency(invoice)

    def _test_invoice_manual_edition_of_taxes_foreign_currency(self, invoice):
        self.assertInvoiceValues(invoice, [
            {
                'product_id': self.product_a.id,
                'tax_ids': (self.tax_sale_a + self.tax_sale_b).ids,
                'tax_line_id': False,
                'amount_currency': -2000.0,
                'debit': 0.0,
                'credit': 1000.0,
            },
            {
                'product_id': False,
                'tax_ids': [],
                'tax_line_id': self.tax_sale_a.id,
                'amount_currency': -310.0,
                'debit': 0.0,
                'credit': 155.0,
            },
            {
                'product_id': False,
                'tax_ids': [],
                'tax_line_id': self.tax_sale_b.id,
                'amount_currency': -290.0,
                'debit': 0.0,
                'credit': 145.0,
            },
            {
                'product_id': False,
                'tax_ids': [],
                'tax_line_id': False,
                'amount_currency': 2600.0,
                'debit': 1300.0,
                'credit': 0.0,
            },
        ], {
            'amount_untaxed': 2000.0,
            'amount_tax': 600.0,
            'amount_total': 2600.0,
        })

    def test_invoice_create_manual_edition_of_taxes_foreign_currency(self):
        invoice = self.env['account.move'].create({
            'move_type': 'out_invoice',
            'partner_id': self.partner_a.id,
            'invoice_date': '2017-01-01',
            'currency_id': self.currency_data['currency'].id,
            'invoice_line_ids': [(0, 0, {
                'product_id': self.product_a.id,
                'tax_ids': [(6, 0, (self.tax_sale_a + self.tax_sale_b).ids)],
            })],
        })

        tax_line_1 = invoice.line_ids.filtered(lambda line: line.tax_line_id == self.tax_sale_a)
        tax_line_2 = invoice.line_ids.filtered(lambda line: line.tax_line_id == self.tax_sale_b)
        invoice.write({
            'line_ids': [
                (1, tax_line_1.id, {'amount_currency': tax_line_1.amount_currency - 10.0}),
                (1, tax_line_2.id, {'amount_currency': tax_line_2.amount_currency + 10.0}),
            ],
        })

        self._test_manual_edition_of_taxes_foreign_currency(invoice)

        invoice.post()

        self._test_manual_edition_of_taxes_foreign_currency(invoice)

    def test_invoice_onchange_manual_edition_of_taxes_foreign_currency(self):
        move_form = Form(self.env['account.move'].with_context(default_move_type='out_invoice'))
        move_form.partner_id = self.partner_a
        move_form.invoice_date = fields.Date.from_string('2017-01-01')
        move_form.currency_id = self.currency_data['currency']
        with move_form.invoice_line_ids.new() as line_form:
            line_form.product_id = self.product_a
            line_form.tax_ids.clear()
            line_form.tax_ids.add(self.tax_sale_a)
            line_form.tax_ids.add(self.tax_sale_b)
        invoice = move_form.save()

        tax_line_index_1 = [line.tax_line_id for line in invoice.line_ids].index(self.tax_sale_a)
        tax_line_index_2 = [line.tax_line_id for line in invoice.line_ids].index(self.tax_sale_b)
        with Form(invoice) as move_form:
            with move_form.line_ids.edit(tax_line_index_1) as line_form:
                line_form.amount_currency -= 10.0
            with move_form.line_ids.edit(tax_line_index_2) as line_form:
                line_form.amount_currency += 10.0

        self._test_manual_edition_of_taxes_foreign_currency(invoice)

        invoice.post()

        self._test_manual_edition_of_taxes_foreign_currency(invoice)
