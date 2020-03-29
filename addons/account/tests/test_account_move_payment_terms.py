# -*- coding: utf-8 -*-
from odoo.addons.account.tests.common import AccountTestInvoicingCommon
from odoo.tests.common import Form
from odoo.tests import tagged
from odoo import fields
from odoo.exceptions import UserError

from unittest.mock import patch


@tagged('post_install', '-at_install')
class TestAccountMovePaymentTerms(AccountTestInvoicingCommon):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        cls.term_30_days = cls.env.ref('account.account_payment_term_30days')
        cls.term_30_in_advance = cls.env['account.payment.term'].create({
            'name': '30% Advance End of Following Month',
            'note': 'Payment terms: 30% Advance End of Following Month',
            'line_ids': [
                (0, 0, {
                    'value': 'percent',
                    'value_amount': 30.0,
                    'sequence': 400,
                    'days': 0,
                    'option': 'day_after_invoice_date',
                }),
                (0, 0, {
                    'value': 'balance',
                    'value_amount': 0.0,
                    'sequence': 500,
                    'days': 31,
                    'option': 'day_following_month',
                }),
            ],
        })

    def _test_payment_terms_30_days(self, invoice):
        self.assertInvoiceValues(invoice, [
            {
                'product_id': self.product_a.id,
                'price_unit': 2000.0,
                'price_subtotal': 2000.0,
                'tax_ids': self.product_a.taxes_id.ids,
                'tax_line_id': False,
                'currency_id': self.currency_data['currency'].id,
                'amount_currency': -2000.0,
                'debit': 0.0,
                'credit': 1000.0,
                'date_maturity': False,
            },
            {
                'product_id': False,
                'price_unit': 0.0,
                'price_subtotal': 0.0,
                'tax_ids': [],
                'tax_line_id': self.product_a.taxes_id.id,
                'currency_id': self.currency_data['currency'].id,
                'amount_currency': -300.0,
                'debit': 0.0,
                'credit': 150.0,
                'date_maturity': False,
            },
            {
                'product_id': False,
                'price_unit': 0.0,
                'price_subtotal': 0.0,
                'tax_ids': [],
                'tax_line_id': False,
                'currency_id': self.currency_data['currency'].id,
                'amount_currency': 2300.0,
                'debit': 1150.0,
                'credit': 0.0,
                'date_maturity': fields.Date.from_string('2019-01-31'),
            },
        ], {
            'invoice_payment_term_id': self.term_30_days.id,
            'invoice_date_due': fields.Date.from_string('2019-01-31'),
            'amount_untaxed': 2000.0,
            'amount_tax': 300.0,
            'amount_total': 2300.0,
        })

    def _test_payment_terms_30_in_advance(self, invoice):
        self.assertInvoiceValues(invoice, [
            {
                'product_id': self.product_a.id,
                'price_unit': 2000.0,
                'price_subtotal': 2000.0,
                'tax_ids': self.product_a.taxes_id.ids,
                'tax_line_id': False,
                'currency_id': self.currency_data['currency'].id,
                'amount_currency': -2000.0,
                'debit': 0.0,
                'credit': 1000.0,
                'date_maturity': False,
            },
            {
                'product_id': False,
                'price_unit': 0.0,
                'price_subtotal': 0.0,
                'tax_ids': [],
                'tax_line_id': self.product_a.taxes_id.id,
                'currency_id': self.currency_data['currency'].id,
                'amount_currency': -300.0,
                'debit': 0.0,
                'credit': 150.0,
                'date_maturity': False,
            },
            {
                'product_id': False,
                'price_unit': 0.0,
                'price_subtotal': 0.0,
                'tax_ids': [],
                'tax_line_id': False,
                'currency_id': self.currency_data['currency'].id,
                'amount_currency': 690.0,
                'debit': 345.0,
                'credit': 0.0,
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
            {
                'product_id': False,
                'price_unit': 0.0,
                'price_subtotal': 0.0,
                'tax_ids': [],
                'tax_line_id': False,
                'currency_id': self.currency_data['currency'].id,
                'amount_currency': 1610.0,
                'debit': 805.0,
                'credit': 0.0,
                'date_maturity': fields.Date.from_string('2019-02-28'),
            },
        ], {
            'invoice_payment_term_id': self.term_30_in_advance.id,
            'invoice_date_due': fields.Date.from_string('2019-02-28'),
            'amount_untaxed': 2000.0,
            'amount_tax': 300.0,
            'amount_total': 2300.0,
        })

    def test_create_payment_terms_flow(self):
        self.partner_a.property_payment_term_id = self.term_30_days

        invoice = self.env['account.move'].create({
            'move_type': 'out_invoice',
            'partner_id': self.partner_a.id,
            'invoice_date': '2019-01-01',
            'currency_id': self.currency_data['currency'].id,
            'invoice_line_ids': [(0, 0, {
                'product_id': self.product_a.id,
                'tax_ids': [(6, 0, self.product_a.taxes_id.ids)],
            })],
        })

        self._test_payment_terms_30_days(invoice)

        invoice.invoice_payment_term_id = self.term_30_in_advance

        self._test_payment_terms_30_in_advance(invoice)

    def test_onchange_payment_terms_flow(self):
        self.partner_a.property_payment_term_id = self.term_30_days

        move_form = Form(self.env['account.move'].with_context(default_move_type='out_invoice'))
        move_form.partner_id = self.partner_a
        move_form.invoice_date = fields.Date.from_string('2019-01-01')
        move_form.currency_id = self.currency_data['currency']
        with move_form.invoice_line_ids.new() as line_form:
            line_form.product_id = self.product_a
        invoice = move_form.save()

        self._test_payment_terms_30_days(invoice)

        with Form(invoice) as move_form:
            move_form.invoice_payment_term_id = self.term_30_in_advance

        self._test_payment_terms_30_in_advance(invoice)
