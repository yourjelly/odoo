# -*- coding: utf-8 -*-
from odoo.tests.common import Form, SavepointCase
from odoo.tests import tagged
from odoo import fields
from odoo.exceptions import ValidationError

from datetime import timedelta

import logging

_logger = logging.getLogger(__name__)


@tagged('post_install', '-at_install')
class TestAccountMove(SavepointCase):

    # -------------------------------------------------------------------------
    # DATA GENERATION
    # -------------------------------------------------------------------------

    @classmethod
    def setUpClass(cls):
        super(TestAccountMove, cls).setUpClass()

        chart_template = cls.env.user.company_id.chart_template_id
        if not chart_template:
            cls.skipTest("Reports Tests skipped because the user's company has no chart of accounts.")

        # Create companies.
        cls.company_parent = cls.env['res.company'].create({
            'name': 'company_parent',
            'currency_id': cls.env.user.company_id.currency_id.id,
        })
        cls.gold_currency = cls.env['res.currency'].create({
            'name': 'Gold Coin',
            'symbol': '☺',
            'rounding': 0.001,
            'position': 'after',
            'currency_unit_label': 'Gold',
            'currency_subunit_label': 'Silver',
        })
        cls.company_child = cls.env['res.company'].create({
            'name': 'company_child',
            'currency_id': cls.gold_currency.id,
            'parent_id': cls.company_parent.id,
        })
        cls.rate1 = cls.env['res.currency.rate'].create({
            'name': '2016-01-01',
            'rate': 3.0,
            'currency_id': cls.gold_currency.id,
            'company_id': cls.company_parent.id,
        })
        cls.rate2 = cls.env['res.currency.rate'].create({
            'name': '2017-01-01',
            'rate': 2.0,
            'currency_id': cls.gold_currency.id,
            'company_id': cls.company_parent.id,
        })

        # Create user.
        user = cls.env['res.users'].create({
            'name': 'Because I am accountman!',
            'login': 'accountman',
            'groups_id': [(6, 0, cls.env.user.groups_id.ids)],
            'company_id': cls.company_parent.id,
            'company_ids': [(6, 0, (cls.company_parent + cls.company_child).ids)],
        })
        user.partner_id.email = 'accountman@test.com'

        # Shadow the current environment/cursor with one having the report user.
        # This is mandatory to test access rights.
        cls.env = cls.env(user=user)
        cls.cr = cls.env.cr

        # Rebrowse with the new environment.
        chart_template = cls.env['account.chart.template'].browse(chart_template.id)

        # Install the chart of accounts being the same as the current user's company.
        # The 'test' user is set by default on the company_parent meaning he has access to both companies.
        chart_template.try_loading_for_current_company()
        user.company_id = cls.company_child
        chart_template.try_loading_for_current_company()
        cls.company_child.currency_id = cls.gold_currency
        user.company_id = cls.company_parent

        # Accounts definition.
        cls.parent_acc_revenue_1 = cls.env['account.account'].search([
            ('company_id', '=', cls.company_parent.id),
            ('user_type_id', '=', cls.env.ref('account.data_account_type_revenue').id)
        ], limit=1)
        cls.parent_acc_revenue_2 = cls.parent_acc_revenue_1.copy()
        cls.parent_acc_revenue_3 = cls.parent_acc_revenue_1.copy()
        cls.parent_acc_expense_1 = cls.env['account.account'].search([
            ('company_id', '=', cls.company_parent.id),
            ('user_type_id', '=', cls.env.ref('account.data_account_type_expenses').id)
        ], limit=1)
        cls.parent_acc_expense_2 = cls.parent_acc_expense_1.copy()
        cls.parent_acc_expense_3 = cls.parent_acc_expense_1.copy()
        cls.parent_acc_receivable_1 = cls.env['account.account'].search([
            ('company_id', '=', cls.company_parent.id),
            ('user_type_id.type', '=', 'receivable')
        ], limit=1)
        cls.parent_acc_receivable_2 = cls.parent_acc_receivable_1.copy()
        cls.parent_acc_payable_1 = cls.env['account.account'].search([
            ('company_id', '=', cls.company_parent.id),
            ('user_type_id.type', '=', 'payable')
        ], limit=1)
        cls.parent_acc_payable_2 = cls.parent_acc_receivable_1.copy()

        # Taxes definition.
        cls.parent_tax_sale_1 = cls.company_parent.account_sale_tax_id
        cls.parent_tax_sale_2 = cls.parent_tax_sale_1.copy()
        cls.parent_tax_sale_3 = cls.parent_tax_sale_2.copy()

        # Fiscal position definition.
        cls.parent_fp_1 = cls.env['account.fiscal.position'].create({
            'name': 'parent_fp_1',
            'tax_ids': [(0, None, {
                'tax_src_id': cls.parent_tax_sale_1.id,
                'tax_dest_id': cls.parent_tax_sale_3.id,
            })],
            'account_ids': [(0, None, {
                'account_src_id': cls.parent_acc_revenue_1.id,
                'account_dest_id': cls.parent_acc_revenue_3.id,
            })],
        })

        # Payment terms definition.
        cls.pay_terms_immediate = cls.env.ref('account.account_payment_term_immediate')
        cls.pay_terms_advance = cls.env['account.payment.term'].create({
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

        # Partners definition.
        cls.partner_a = cls.env['res.partner'].create({
            'name': 'partner_a',
            'property_payment_term_id': cls.pay_terms_immediate.id,
            'property_account_receivable_id': cls.parent_acc_receivable_1.id,
            'property_account_payable_id': cls.parent_acc_payable_1.id,
            'company_id': False,
        })
        cls.partner_b = cls.env['res.partner'].create({
            'name': 'partner_b',
            'property_payment_term_id': cls.pay_terms_advance.id,
            'property_account_position_id': cls.parent_fp_1.id,
            'property_account_receivable_id': cls.parent_acc_receivable_2.id,
            'property_account_payable_id': cls.parent_acc_payable_2.id,
            'company_id': False,
        })

        # Uom definition.
        cls.uom_unit = cls.env.ref('uom.product_uom_unit')
        cls.uom_dozen = cls.env.ref('uom.product_uom_dozen')

        # Products definition.
        cls.product_a = cls.env['product.product'].create({
            'name': 'product_a',
            'lst_price': 1000.0,
            'standard_price': 800.0,
            'taxes_id': [(6, 0, cls.parent_tax_sale_1.ids)],
            'uom_id': cls.uom_unit.id,
        })
        cls.product_a.product_tmpl_id.property_account_income_id = cls.parent_acc_revenue_1.id
        cls.product_a.product_tmpl_id.property_account_expense_id = cls.parent_acc_expense_1.id
        cls.product_b = cls.env['product.product'].create({
            'name': 'product_b',
            'lst_price': 2000.0,
            'standard_price': 1500.0,
            'taxes_id': [(6, 0, cls.parent_tax_sale_2.ids)],
            'uom_id': cls.uom_dozen.id,
        })
        cls.product_b.product_tmpl_id.property_account_income_id = cls.parent_acc_revenue_2.id,
        cls.product_b.product_tmpl_id.property_account_expense_id = cls.parent_acc_expense_2.id,

    # -------------------------------------------------------------------------
    # TEST out_invoice / out_refund / in_invoice / in_refund
    # -------------------------------------------------------------------------

    def test_out_invoice_line_onchange_product(self):
        move_form = Form(self.env['account.move'].with_context(type='out_invoice'))
        move_form.invoice_date = fields.Date.from_string('2019-01-01')
        move_form.partner_id = self.partner_a
        with move_form.invoice_line_ids.new() as line_form:
            line_form.product_id = self.product_a
        move = move_form.save()

        self.assertRecordValues(move.invoice_line_ids, [
            {
                'name': 'product_a',
                'product_id': self.product_a.id,
                'account_id': self.parent_acc_revenue_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': self.uom_unit.id,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 1000.0,
                'price_subtotal': 1000.0,
                'price_total': 1150.0,
                'tax_ids': self.parent_tax_sale_1.ids,
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 1000.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': False,
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
        ])
        self.assertRecordValues(move.line_ids, [
            {
                'name': 'product_a',
                'product_id': self.product_a.id,
                'account_id': self.parent_acc_revenue_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': self.uom_unit.id,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 1000.0,
                'price_subtotal': 1000.0,
                'price_total': 1150.0,
                'tax_ids': self.parent_tax_sale_1.ids,
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 1000.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': False,
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
            {
                'name': self.parent_tax_sale_1.name,
                'product_id': False,
                'account_id': self.parent_tax_sale_1.account_id.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': False,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 150.0,
                'price_subtotal': 150.0,
                'price_total': 150.0,
                'tax_ids': [],
                'tax_line_id': self.parent_tax_sale_1.id,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 150.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': 'other',
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
            {
                'name': '/',
                'product_id': False,
                'account_id': self.parent_acc_receivable_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': False,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': -1150.0,
                'price_subtotal': -1150.0,
                'price_total': -1150.0,
                'tax_ids': [],
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 1150.0,
                'credit': 0.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': 'other',
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
        ])
        self.assertRecordValues(move, [{
            'amount_untaxed': 1000.0,
            'amount_tax': 150.0,
            'amount_total': 1150.0,
        }])

        # Change the product set on the line.
        move_form = Form(move)
        with move_form.invoice_line_ids.edit(0) as line_form:
            line_form.product_id = self.product_b
        move = move_form.save()

        self.assertRecordValues(move.invoice_line_ids, [
            {
                'name': 'product_b',
                'product_id': self.product_b.id,
                'account_id': self.parent_acc_revenue_2.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': self.uom_dozen.id,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 2000.0,
                'price_subtotal': 2000.0,
                'price_total': 2300.0,
                'tax_ids': self.parent_tax_sale_2.ids,
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 2000.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': False,
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
        ])
        self.assertRecordValues(move.line_ids, [
            {
                'name': 'product_b',
                'product_id': self.product_b.id,
                'account_id': self.parent_acc_revenue_2.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': self.uom_dozen.id,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 2000.0,
                'price_subtotal': 2000.0,
                'price_total': 2300.0,
                'tax_ids': self.parent_tax_sale_2.ids,
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 2000.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': False,
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
            {
                'name': '/',
                'product_id': False,
                'account_id': self.parent_acc_receivable_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': False,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': -2300.0,
                'price_subtotal': -2300.0,
                'price_total': -2300.0,
                'tax_ids': [],
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 2300.0,
                'credit': 0.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': 'other',
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
            {
                'name': self.parent_tax_sale_2.name,
                'product_id': False,
                'account_id': self.parent_tax_sale_2.account_id.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': False,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 300.0,
                'price_subtotal': 300.0,
                'price_total': 300.0,
                'tax_ids': [],
                'tax_line_id': self.parent_tax_sale_2.id,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 300.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': 'other',
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
        ])
        self.assertRecordValues(move, [{
            'amount_untaxed': 2000.0,
            'amount_tax': 300.0,
            'amount_total': 2300.0,
        }])

    def test_out_invoice_line_onchange_account(self):
        # One product line, custom account.
        move_form = Form(self.env['account.move'].with_context(type='out_invoice'))
        move_form.invoice_date = fields.Date.from_string('2019-01-01')
        move_form.partner_id = self.partner_a
        with move_form.invoice_line_ids.new() as line_form:
            line_form.product_id = self.product_a
            line_form.account_id = self.parent_acc_revenue_2
        move = move_form.save()

        self.assertRecordValues(move.invoice_line_ids, [
            {
                'name': 'product_a',
                'product_id': self.product_a.id,
                'account_id': self.parent_acc_revenue_2.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': self.uom_unit.id,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 1000.0,
                'price_subtotal': 1000.0,
                'price_total': 1150.0,
                'tax_ids': self.parent_tax_sale_1.ids,
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 1000.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': False,
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
        ])
        self.assertRecordValues(move.line_ids, [
            {
                'name': 'product_a',
                'product_id': self.product_a.id,
                'account_id': self.parent_acc_revenue_2.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': self.uom_unit.id,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 1000.0,
                'price_subtotal': 1000.0,
                'price_total': 1150.0,
                'tax_ids': self.parent_tax_sale_1.ids,
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 1000.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': False,
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
            {
                'name': self.parent_tax_sale_1.name,
                'product_id': False,
                'account_id': self.parent_tax_sale_1.account_id.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': False,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 150.0,
                'price_subtotal': 150.0,
                'price_total': 150.0,
                'tax_ids': [],
                'tax_line_id': self.parent_tax_sale_1.id,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 150.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': 'other',
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
            {
                'name': '/',
                'product_id': False,
                'account_id': self.parent_acc_receivable_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': False,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': -1150.0,
                'price_subtotal': -1150.0,
                'price_total': -1150.0,
                'tax_ids': [],
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 1150.0,
                'credit': 0.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': 'other',
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
        ])
        self.assertRecordValues(move, [{
            'amount_untaxed': 1000.0,
            'amount_tax': 150.0,
            'amount_total': 1150.0,
        }])

        # One product line, custom account from aml tab.
        move_form = Form(move)
        with move_form.line_ids.edit(0) as line_form:
            line_form.account_id = self.parent_acc_revenue_1
        move = move_form.save()

        self.assertRecordValues(move.invoice_line_ids, [
            {
                'name': 'product_a',
                'product_id': self.product_a.id,
                'account_id': self.parent_acc_revenue_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': self.uom_unit.id,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 1000.0,
                'price_subtotal': 1000.0,
                'price_total': 1150.0,
                'tax_ids': self.parent_tax_sale_1.ids,
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 1000.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': False,
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
        ])
        self.assertRecordValues(move.line_ids, [
            {
                'name': 'product_a',
                'product_id': self.product_a.id,
                'account_id': self.parent_acc_revenue_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': self.uom_unit.id,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 1000.0,
                'price_subtotal': 1000.0,
                'price_total': 1150.0,
                'tax_ids': self.parent_tax_sale_1.ids,
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 1000.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': False,
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
            {
                'name': self.parent_tax_sale_1.name,
                'product_id': False,
                'account_id': self.parent_tax_sale_1.account_id.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': False,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 150.0,
                'price_subtotal': 150.0,
                'price_total': 150.0,
                'tax_ids': [],
                'tax_line_id': self.parent_tax_sale_1.id,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 150.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': 'other',
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
            {
                'name': '/',
                'product_id': False,
                'account_id': self.parent_acc_receivable_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': False,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': -1150.0,
                'price_subtotal': -1150.0,
                'price_total': -1150.0,
                'tax_ids': [],
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 1150.0,
                'credit': 0.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': 'other',
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
        ])
        self.assertRecordValues(move, [{
            'amount_untaxed': 1000.0,
            'amount_tax': 150.0,
            'amount_total': 1150.0,
        }])

    def test_out_invoice_line_onchange_quantity(self):
        # One product line, custom quantity.
        move_form = Form(self.env['account.move'].with_context(type='out_invoice'))
        move_form.invoice_date = fields.Date.from_string('2019-01-01')
        move_form.partner_id = self.partner_a
        with move_form.invoice_line_ids.new() as line_form:
            line_form.product_id = self.product_a
            line_form.quantity = 2
        move = move_form.save()

        self.assertRecordValues(move.invoice_line_ids, [
            {
                'name': 'product_a',
                'product_id': self.product_a.id,
                'account_id': self.parent_acc_revenue_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': self.uom_unit.id,
                'quantity': 2.0,
                'discount': 0.0,
                'price_unit': 1000.0,
                'price_subtotal': 2000.0,
                'price_total': 2300.0,
                'tax_ids': self.parent_tax_sale_1.ids,
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 2000.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': False,
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
        ])
        self.assertRecordValues(move.line_ids, [
            {
                'name': 'product_a',
                'product_id': self.product_a.id,
                'account_id': self.parent_acc_revenue_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': self.uom_unit.id,
                'quantity': 2.0,
                'discount': 0.0,
                'price_unit': 1000.0,
                'price_subtotal': 2000.0,
                'price_total': 2300.0,
                'tax_ids': self.parent_tax_sale_1.ids,
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 2000.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': False,
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
            {
                'name': self.parent_tax_sale_1.name,
                'product_id': False,
                'account_id': self.parent_tax_sale_1.account_id.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': False,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 300.0,
                'price_subtotal': 300.0,
                'price_total': 300.0,
                'tax_ids': [],
                'tax_line_id': self.parent_tax_sale_1.id,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 300.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': 'other',
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
            {
                'name': '/',
                'product_id': False,
                'account_id': self.parent_acc_receivable_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': False,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': -2300.0,
                'price_subtotal': -2300.0,
                'price_total': -2300.0,
                'tax_ids': [],
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 2300.0,
                'credit': 0.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': 'other',
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
        ])
        self.assertRecordValues(move, [{
            'amount_untaxed': 2000.0,
            'amount_tax': 300.0,
            'amount_total': 2300.0,
        }])

    def test_out_invoice_line_onchange_price_unit(self):
        # One product line, custom price_unit.
        move_form = Form(self.env['account.move'].with_context(type='out_invoice'))
        move_form.invoice_date = fields.Date.from_string('2019-01-01')
        move_form.partner_id = self.partner_a
        with move_form.invoice_line_ids.new() as line_form:
            line_form.product_id = self.product_a
            line_form.price_unit = 2000
        move = move_form.save()

        self.assertRecordValues(move.invoice_line_ids, [
            {
                'name': 'product_a',
                'product_id': self.product_a.id,
                'account_id': self.parent_acc_revenue_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': self.uom_unit.id,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 2000.0,
                'price_subtotal': 2000.0,
                'price_total': 2300.0,
                'tax_ids': self.parent_tax_sale_1.ids,
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 2000.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': False,
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
        ])
        self.assertRecordValues(move.line_ids, [
            {
                'name': 'product_a',
                'product_id': self.product_a.id,
                'account_id': self.parent_acc_revenue_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': self.uom_unit.id,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 2000.0,
                'price_subtotal': 2000.0,
                'price_total': 2300.0,
                'tax_ids': self.parent_tax_sale_1.ids,
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 2000.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': False,
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
            {
                'name': self.parent_tax_sale_1.name,
                'product_id': False,
                'account_id': self.parent_tax_sale_1.account_id.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': False,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 300.0,
                'price_subtotal': 300.0,
                'price_total': 300.0,
                'tax_ids': [],
                'tax_line_id': self.parent_tax_sale_1.id,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 300.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': 'other',
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
            {
                'name': '/',
                'product_id': False,
                'account_id': self.parent_acc_receivable_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': False,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': -2300.0,
                'price_subtotal': -2300.0,
                'price_total': -2300.0,
                'tax_ids': [],
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 2300.0,
                'credit': 0.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': 'other',
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
        ])
        self.assertRecordValues(move, [{
            'amount_untaxed': 2000.0,
            'amount_tax': 300.0,
            'amount_total': 2300.0,
        }])

        # Edit balance, check impact to the price_unit.
        move_form = Form(move)
        with move_form.line_ids.edit(0) as line_form:
            line_form.credit = 3000
        move = move_form.save()

        self.assertRecordValues(move.invoice_line_ids, [
            {
                'name': 'product_a',
                'product_id': self.product_a.id,
                'account_id': self.parent_acc_revenue_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': self.uom_unit.id,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 3000.0,
                'price_subtotal': 3000.0,
                'price_total': 3450.0,
                'tax_ids': self.parent_tax_sale_1.ids,
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 3000.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': False,
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
        ])
        self.assertRecordValues(move.line_ids, [
            {
                'name': 'product_a',
                'product_id': self.product_a.id,
                'account_id': self.parent_acc_revenue_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': self.uom_unit.id,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 3000.0,
                'price_subtotal': 3000.0,
                'price_total': 3450.0,
                'tax_ids': self.parent_tax_sale_1.ids,
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 3000.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': False,
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
            {
                'name': self.parent_tax_sale_1.name,
                'product_id': False,
                'account_id': self.parent_tax_sale_1.account_id.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': False,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 450.0,
                'price_subtotal': 450.0,
                'price_total': 450.0,
                'tax_ids': [],
                'tax_line_id': self.parent_tax_sale_1.id,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 450.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': 'other',
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
            {
                'name': '/',
                'product_id': False,
                'account_id': self.parent_acc_receivable_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': False,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': -3450.0,
                'price_subtotal': -3450.0,
                'price_total': -3450.0,
                'tax_ids': [],
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 3450.0,
                'credit': 0.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': 'other',
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
        ])
        self.assertRecordValues(move, [{
            'amount_untaxed': 3000.0,
            'amount_tax': 450.0,
            'amount_total': 3450.0,
        }])

    def test_out_invoice_line_onchange_discount(self):
        # One product line having 50% discount.
        move_form = Form(self.env['account.move'].with_context(type='out_invoice'))
        move_form.invoice_date = fields.Date.from_string('2019-01-01')
        move_form.partner_id = self.partner_a
        with move_form.invoice_line_ids.new() as line_form:
            line_form.product_id = self.product_a
            line_form.discount = 50.0
        move = move_form.save()

        self.assertRecordValues(move.invoice_line_ids, [
            {
                'name': 'product_a',
                'product_id': self.product_a.id,
                'account_id': self.parent_acc_revenue_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': self.uom_unit.id,
                'quantity': 1.0,
                'discount': 50.0,
                'price_unit': 1000.0,
                'price_subtotal': 500.0,
                'price_total': 575.0,
                'tax_ids': self.parent_tax_sale_1.ids,
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 500.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': False,
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
        ])
        self.assertRecordValues(move.line_ids, [
            {
                'name': 'product_a',
                'product_id': self.product_a.id,
                'account_id': self.parent_acc_revenue_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': self.uom_unit.id,
                'quantity': 1.0,
                'discount': 50.0,
                'price_unit': 1000.0,
                'price_subtotal': 500.0,
                'price_total': 575.0,
                'tax_ids': self.parent_tax_sale_1.ids,
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 500.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': False,
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
            {
                'name': self.parent_tax_sale_1.name,
                'product_id': False,
                'account_id': self.parent_tax_sale_1.account_id.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': False,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 75.0,
                'price_subtotal': 75.0,
                'price_total': 75.0,
                'tax_ids': [],
                'tax_line_id': self.parent_tax_sale_1.id,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 75.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': 'other',
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
            {
                'name': '/',
                'product_id': False,
                'account_id': self.parent_acc_receivable_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': False,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': -575.0,
                'price_subtotal': -575.0,
                'price_total': -575.0,
                'tax_ids': [],
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 575.0,
                'credit': 0.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': 'other',
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
        ])
        self.assertRecordValues(move, [{
            'amount_untaxed': 500.0,
            'amount_tax': 75.0,
            'amount_total': 575.0,
        }])

        # One more product line having 100% discount.
        move_form = Form(move)
        with move_form.invoice_line_ids.new() as line_form:
            line_form.product_id = self.product_a
            line_form.discount = 100
        move = move_form.save()

        self.assertRecordValues(move.invoice_line_ids, [
            {
                'name': 'product_a',
                'product_id': self.product_a.id,
                'account_id': self.parent_acc_revenue_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': self.uom_unit.id,
                'quantity': 1.0,
                'discount': 50.0,
                'price_unit': 1000.0,
                'price_subtotal': 500.0,
                'price_total': 575.0,
                'tax_ids': self.parent_tax_sale_1.ids,
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 500.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': False,
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
            {
                'name': 'product_a',
                'product_id': self.product_a.id,
                'account_id': self.parent_acc_revenue_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': self.uom_unit.id,
                'quantity': 1.0,
                'discount': 100.0,
                'price_unit': 1000.0,
                'price_subtotal': 0.0,
                'price_total': 0.0,
                'tax_ids': self.parent_tax_sale_1.ids,
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 0.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': False,
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
        ])
        self.assertRecordValues(move.line_ids, [
            {
                'name': 'product_a',
                'product_id': self.product_a.id,
                'account_id': self.parent_acc_revenue_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': self.uom_unit.id,
                'quantity': 1.0,
                'discount': 50.0,
                'price_unit': 1000.0,
                'price_subtotal': 500.0,
                'price_total': 575.0,
                'tax_ids': self.parent_tax_sale_1.ids,
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 500.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': False,
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
            {
                'name': self.parent_tax_sale_1.name,
                'product_id': False,
                'account_id': self.parent_tax_sale_1.account_id.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': False,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 75.0,
                'price_subtotal': 75.0,
                'price_total': 75.0,
                'tax_ids': [],
                'tax_line_id': self.parent_tax_sale_1.id,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 75.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': 'other',
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
            {
                'name': '/',
                'product_id': False,
                'account_id': self.parent_acc_receivable_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': False,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': -575.0,
                'price_subtotal': -575.0,
                'price_total': -575.0,
                'tax_ids': [],
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 575.0,
                'credit': 0.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': 'other',
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
            {
                'name': 'product_a',
                'product_id': self.product_a.id,
                'account_id': self.parent_acc_revenue_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': self.uom_unit.id,
                'quantity': 1.0,
                'discount': 100.0,
                'price_unit': 1000.0,
                'price_subtotal': 0.0,
                'price_total': 0.0,
                'tax_ids': self.parent_tax_sale_1.ids,
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 0.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': False,
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
        ])
        self.assertRecordValues(move, [{
            'amount_untaxed': 500.0,
            'amount_tax': 75.0,
            'amount_total': 575.0,
        }])

        # # Edit balance from the aml tab.
        move_form = Form(move)
        with move_form.line_ids.edit(0) as line_form:
            # Line 1 with 50% discount.
            line_form.credit = 1000
        with move_form.line_ids.edit(3) as line_form:
            # Line 2 with 100% discount.
            line_form.credit = 2000
        move = move_form.save()

        self.assertRecordValues(move.invoice_line_ids, [
            {
                'name': 'product_a',
                'product_id': self.product_a.id,
                'account_id': self.parent_acc_revenue_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': self.uom_unit.id,
                'quantity': 1.0,
                'discount': 50.0,
                'price_unit': 2000.0,
                'price_subtotal': 1000.0,
                'price_total': 1150.0,
                'tax_ids': self.parent_tax_sale_1.ids,
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 1000.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': False,
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
            {
                'name': 'product_a',
                'product_id': self.product_a.id,
                'account_id': self.parent_acc_revenue_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': self.uom_unit.id,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 2000.0,
                'price_subtotal': 2000.0,
                'price_total': 2300.0,
                'tax_ids': self.parent_tax_sale_1.ids,
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 2000.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': False,
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
        ])
        self.assertRecordValues(move.line_ids, [
            {
                'name': 'product_a',
                'product_id': self.product_a.id,
                'account_id': self.parent_acc_revenue_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': self.uom_unit.id,
                'quantity': 1.0,
                'discount': 50.0,
                'price_unit': 2000.0,
                'price_subtotal': 1000.0,
                'price_total': 1150.0,
                'tax_ids': self.parent_tax_sale_1.ids,
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 1000.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': False,
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
            {
                'name': self.parent_tax_sale_1.name,
                'product_id': False,
                'account_id': self.parent_tax_sale_1.account_id.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': False,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 450.0,
                'price_subtotal': 450.0,
                'price_total': 450.0,
                'tax_ids': [],
                'tax_line_id': self.parent_tax_sale_1.id,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 450.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': 'other',
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
            {
                'name': '/',
                'product_id': False,
                'account_id': self.parent_acc_receivable_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': False,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': -3450.0,
                'price_subtotal': -3450.0,
                'price_total': -3450.0,
                'tax_ids': [],
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 3450.0,
                'credit': 0.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': 'other',
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
            {
                'name': 'product_a',
                'product_id': self.product_a.id,
                'account_id': self.parent_acc_revenue_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': self.uom_unit.id,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 2000.0,
                'price_subtotal': 2000.0,
                'price_total': 2300.0,
                'tax_ids': self.parent_tax_sale_1.ids,
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 2000.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': False,
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
        ])
        self.assertRecordValues(move, [{
            'amount_untaxed': 3000.0,
            'amount_tax': 450.0,
            'amount_total': 3450.0,
        }])

    def test_out_invoice_line_onchange_uom(self):
        move_form = Form(self.env['account.move'].with_context(type='out_invoice'))
        move_form.invoice_date = fields.Date.from_string('2019-01-01')
        move_form.partner_id = self.partner_a
        with move_form.invoice_line_ids.new() as line_form:
            line_form.product_id = self.product_a
            line_form.product_uom_id = self.uom_dozen
        move = move_form.save()

        self.assertRecordValues(move.invoice_line_ids, [
            {
                'name': 'product_a',
                'product_id': self.product_a.id,
                'account_id': self.parent_acc_revenue_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': self.uom_dozen.id,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 12000.0,
                'price_subtotal': 12000.0,
                'price_total': 13800.0,
                'tax_ids': self.parent_tax_sale_1.ids,
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 12000.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': False,
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
        ])
        self.assertRecordValues(move.line_ids, [
            {
                'name': 'product_a',
                'product_id': self.product_a.id,
                'account_id': self.parent_acc_revenue_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': self.uom_dozen.id,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 12000.0,
                'price_subtotal': 12000.0,
                'price_total': 13800.0,
                'tax_ids': self.parent_tax_sale_1.ids,
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 12000.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': False,
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
            {
                'name': self.parent_tax_sale_1.name,
                'product_id': False,
                'account_id': self.parent_tax_sale_1.account_id.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': False,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 1800.0,
                'price_subtotal': 1800.0,
                'price_total': 1800.0,
                'tax_ids': [],
                'tax_line_id': self.parent_tax_sale_1.id,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 1800.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': 'other',
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
            {
                'name': '/',
                'product_id': False,
                'account_id': self.parent_acc_receivable_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': False,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': -13800.0,
                'price_subtotal': -13800.0,
                'price_total': -13800.0,
                'tax_ids': [],
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 13800.0,
                'credit': 0.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': 'other',
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
        ])
        self.assertRecordValues(move, [{
            'amount_untaxed': 12000.0,
            'amount_tax': 1800.0,
            'amount_total': 13800.0,
        }])

    def test_out_invoice_line_onchange_taxes(self):
        # One product line with two taxes: 15% tax + 15% tax.
        move_form = Form(self.env['account.move'].with_context(type='out_invoice'))
        move_form.invoice_date = fields.Date.from_string('2019-01-01')
        move_form.partner_id = self.partner_a
        with move_form.invoice_line_ids.new() as line_form:
            line_form.product_id = self.product_a
            line_form.tax_ids.add(self.parent_tax_sale_2)
        move = move_form.save()

        self.assertRecordValues(move.invoice_line_ids, [
            {
                'name': 'product_a',
                'product_id': self.product_a.id,
                'account_id': self.parent_acc_revenue_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': self.uom_unit.id,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 1000.0,
                'price_subtotal': 1000.0,
                'price_total': 1300.0,
                'tax_ids': (self.parent_tax_sale_1 + self.parent_tax_sale_2).ids,
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 1000.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': False,
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
        ])
        self.assertRecordValues(move.line_ids, [
            {
                'name': 'product_a',
                'product_id': self.product_a.id,
                'account_id': self.parent_acc_revenue_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': self.uom_unit.id,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 1000.0,
                'price_subtotal': 1000.0,
                'price_total': 1300.0,
                'tax_ids': (self.parent_tax_sale_1 + self.parent_tax_sale_2).ids,
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 1000.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': False,
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
            {
                'name': self.parent_tax_sale_1.name,
                'product_id': False,
                'account_id': self.parent_tax_sale_1.account_id.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': False,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 150.0,
                'price_subtotal': 150.0,
                'price_total': 150.0,
                'tax_ids': [],
                'tax_line_id': self.parent_tax_sale_1.id,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 150.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': 'other',
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
            {
                'name': self.parent_tax_sale_2.name,
                'product_id': False,
                'account_id': self.parent_tax_sale_2.account_id.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': False,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 150.0,
                'price_subtotal': 150.0,
                'price_total': 150.0,
                'tax_ids': [],
                'tax_line_id': self.parent_tax_sale_2.id,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 150.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': 'other',
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
            {
                'name': '/',
                'product_id': False,
                'account_id': self.parent_acc_receivable_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': False,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': -1300.0,
                'price_subtotal': -1300.0,
                'price_total': -1300.0,
                'tax_ids': [],
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 1300.0,
                'credit': 0.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': 'other',
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
        ])
        self.assertRecordValues(move, [{
            'amount_untaxed': 1000.0,
            'amount_tax': 300.0,
            'amount_total': 1300.0,
        }])

        # One more product line with two taxes: 15% tax + 15% tax.
        move_form = Form(move)
        with move_form.invoice_line_ids.new() as line_form:
            line_form.product_id = self.product_a
            line_form.tax_ids.add(self.parent_tax_sale_2)
        move = move_form.save()

        self.assertRecordValues(move.invoice_line_ids, [
            {
                'name': 'product_a',
                'product_id': self.product_a.id,
                'account_id': self.parent_acc_revenue_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': self.uom_unit.id,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 1000.0,
                'price_subtotal': 1000.0,
                'price_total': 1300.0,
                'tax_ids': (self.parent_tax_sale_1 + self.parent_tax_sale_2).ids,
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 1000.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': False,
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
            {
                'name': 'product_a',
                'product_id': self.product_a.id,
                'account_id': self.parent_acc_revenue_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': self.uom_unit.id,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 1000.0,
                'price_subtotal': 1000.0,
                'price_total': 1300.0,
                'tax_ids': (self.parent_tax_sale_1 + self.parent_tax_sale_2).ids,
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 1000.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': False,
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
        ])
        self.assertRecordValues(move.line_ids, [
            {
                'name': 'product_a',
                'product_id': self.product_a.id,
                'account_id': self.parent_acc_revenue_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': self.uom_unit.id,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 1000.0,
                'price_subtotal': 1000.0,
                'price_total': 1300.0,
                'tax_ids': (self.parent_tax_sale_1 + self.parent_tax_sale_2).ids,
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 1000.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': False,
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
            {
                'name': self.parent_tax_sale_1.name,
                'product_id': False,
                'account_id': self.parent_tax_sale_1.account_id.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': False,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 300.0,
                'price_subtotal': 300.0,
                'price_total': 300.0,
                'tax_ids': [],
                'tax_line_id': self.parent_tax_sale_1.id,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 300.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': 'other',
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
            {
                'name': self.parent_tax_sale_2.name,
                'product_id': False,
                'account_id': self.parent_tax_sale_2.account_id.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': False,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 300.0,
                'price_subtotal': 300.0,
                'price_total': 300.0,
                'tax_ids': [],
                'tax_line_id': self.parent_tax_sale_2.id,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 300.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': 'other',
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
            {
                'name': '/',
                'product_id': False,
                'account_id': self.parent_acc_receivable_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': False,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': -2600.0,
                'price_subtotal': -2600.0,
                'price_total': -2600.0,
                'tax_ids': [],
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 2600.0,
                'credit': 0.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': 'other',
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
            {
                'name': 'product_a',
                'product_id': self.product_a.id,
                'account_id': self.parent_acc_revenue_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': self.uom_unit.id,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 1000.0,
                'price_subtotal': 1000.0,
                'price_total': 1300.0,
                'tax_ids': (self.parent_tax_sale_1 + self.parent_tax_sale_2).ids,
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 1000.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': False,
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
        ])
        self.assertRecordValues(move, [{
            'amount_untaxed': 2000.0,
            'amount_tax': 600.0,
            'amount_total': 2600.0,
        }])

        # Edit tax line manually.
        move_form = Form(move)
        with move_form.line_ids.edit(1) as line_form:
            line_form.credit = 600
        move = move_form.save()

        self.assertRecordValues(move.invoice_line_ids, [
            {
                'name': 'product_a',
                'product_id': self.product_a.id,
                'account_id': self.parent_acc_revenue_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': self.uom_unit.id,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 1000.0,
                'price_subtotal': 1000.0,
                'price_total': 1300.0,
                'tax_ids': (self.parent_tax_sale_1 + self.parent_tax_sale_2).ids,
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 1000.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': False,
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
            {
                'name': 'product_a',
                'product_id': self.product_a.id,
                'account_id': self.parent_acc_revenue_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': self.uom_unit.id,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 1000.0,
                'price_subtotal': 1000.0,
                'price_total': 1300.0,
                'tax_ids': (self.parent_tax_sale_1 + self.parent_tax_sale_2).ids,
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 1000.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': False,
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
        ])
        self.assertRecordValues(move.line_ids, [
            {
                'name': 'product_a',
                'product_id': self.product_a.id,
                'account_id': self.parent_acc_revenue_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': self.uom_unit.id,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 1000.0,
                'price_subtotal': 1000.0,
                'price_total': 1300.0,
                'tax_ids': (self.parent_tax_sale_1 + self.parent_tax_sale_2).ids,
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 1000.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': False,
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
            {
                'name': self.parent_tax_sale_1.name,
                'product_id': False,
                'account_id': self.parent_tax_sale_1.account_id.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': False,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 600.0,
                'price_subtotal': 600.0,
                'price_total': 600.0,
                'tax_ids': [],
                'tax_line_id': self.parent_tax_sale_1.id,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 600.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': 'other',
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
            {
                'name': self.parent_tax_sale_2.name,
                'product_id': False,
                'account_id': self.parent_tax_sale_2.account_id.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': False,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 300.0,
                'price_subtotal': 300.0,
                'price_total': 300.0,
                'tax_ids': [],
                'tax_line_id': self.parent_tax_sale_2.id,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 300.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': 'other',
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
            {
                'name': '/',
                'product_id': False,
                'account_id': self.parent_acc_receivable_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': False,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': -2900.0,
                'price_subtotal': -2900.0,
                'price_total': -2900.0,
                'tax_ids': [],
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 2900.0,
                'credit': 0.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': 'other',
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
            {
                'name': 'product_a',
                'product_id': self.product_a.id,
                'account_id': self.parent_acc_revenue_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': self.uom_unit.id,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 1000.0,
                'price_subtotal': 1000.0,
                'price_total': 1300.0,
                'tax_ids': (self.parent_tax_sale_1 + self.parent_tax_sale_2).ids,
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 1000.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': False,
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
        ])
        self.assertRecordValues(move, [{
            'amount_untaxed': 2000.0,
            'amount_tax': 900.0,
            'amount_total': 2900.0,
        }])

        # Remove a tax line.
        move_form = Form(move)
        move_form.line_ids.remove(index=2)
        move = move_form.save()

        self.assertRecordValues(move.invoice_line_ids, [
            {
                'name': 'product_a',
                'product_id': self.product_a.id,
                'account_id': self.parent_acc_revenue_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': self.uom_unit.id,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 1000.0,
                'price_subtotal': 1000.0,
                'price_total': 1300.0,
                'tax_ids': (self.parent_tax_sale_1 + self.parent_tax_sale_2).ids,
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 1000.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': False,
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
            {
                'name': 'product_a',
                'product_id': self.product_a.id,
                'account_id': self.parent_acc_revenue_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': self.uom_unit.id,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 1000.0,
                'price_subtotal': 1000.0,
                'price_total': 1300.0,
                'tax_ids': (self.parent_tax_sale_1 + self.parent_tax_sale_2).ids,
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 1000.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': False,
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
        ])
        self.assertRecordValues(move.line_ids, [
            {
                'name': 'product_a',
                'product_id': self.product_a.id,
                'account_id': self.parent_acc_revenue_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': self.uom_unit.id,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 1000.0,
                'price_subtotal': 1000.0,
                'price_total': 1300.0,
                'tax_ids': (self.parent_tax_sale_1 + self.parent_tax_sale_2).ids,
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 1000.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': False,
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
            {
                'name': self.parent_tax_sale_1.name,
                'product_id': False,
                'account_id': self.parent_tax_sale_1.account_id.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': False,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 600.0,
                'price_subtotal': 600.0,
                'price_total': 600.0,
                'tax_ids': [],
                'tax_line_id': self.parent_tax_sale_1.id,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 600.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': 'other',
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
            {
                'name': '/',
                'product_id': False,
                'account_id': self.parent_acc_receivable_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': False,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': -2600.0,
                'price_subtotal': -2600.0,
                'price_total': -2600.0,
                'tax_ids': [],
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 2600.0,
                'credit': 0.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': 'other',
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
            {
                'name': 'product_a',
                'product_id': self.product_a.id,
                'account_id': self.parent_acc_revenue_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': self.uom_unit.id,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 1000.0,
                'price_subtotal': 1000.0,
                'price_total': 1300.0,
                'tax_ids': (self.parent_tax_sale_1 + self.parent_tax_sale_2).ids,
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 1000.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': False,
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
        ])
        self.assertRecordValues(move, [{
            'amount_untaxed': 2000.0,
            'amount_tax': 600.0,
            'amount_total': 2600.0,
        }])

        # Remove product line.
        move_form = Form(move)
        move_form.invoice_line_ids.remove(index=1)
        move = move_form.save()

        self.assertRecordValues(move.invoice_line_ids, [
            {
                'name': 'product_a',
                'product_id': self.product_a.id,
                'account_id': self.parent_acc_revenue_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': self.uom_unit.id,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 1000.0,
                'price_subtotal': 1000.0,
                'price_total': 1300.0,
                'tax_ids': (self.parent_tax_sale_1 + self.parent_tax_sale_2).ids,
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 1000.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': False,
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
        ])
        self.assertRecordValues(move.line_ids, [
            {
                'name': 'product_a',
                'product_id': self.product_a.id,
                'account_id': self.parent_acc_revenue_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': self.uom_unit.id,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 1000.0,
                'price_subtotal': 1000.0,
                'price_total': 1300.0,
                'tax_ids': (self.parent_tax_sale_1 + self.parent_tax_sale_2).ids,
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 1000.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': False,
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
            {
                'name': self.parent_tax_sale_1.name,
                'product_id': False,
                'account_id': self.parent_tax_sale_1.account_id.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': False,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 150.0,
                'price_subtotal': 150.0,
                'price_total': 150.0,
                'tax_ids': [],
                'tax_line_id': self.parent_tax_sale_1.id,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 150.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': 'other',
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
            {
                'name': '/',
                'product_id': False,
                'account_id': self.parent_acc_receivable_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': False,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': -1300.0,
                'price_subtotal': -1300.0,
                'price_total': -1300.0,
                'tax_ids': [],
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 1300.0,
                'credit': 0.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': 'other',
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
            {
                'name': self.parent_tax_sale_2.name,
                'product_id': False,
                'account_id': self.parent_tax_sale_2.account_id.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': False,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 150.0,
                'price_subtotal': 150.0,
                'price_total': 150.0,
                'tax_ids': [],
                'tax_line_id': self.parent_tax_sale_2.id,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 150.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': 'other',
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
        ])
        self.assertRecordValues(move, [{
            'amount_untaxed': 1000.0,
            'amount_tax': 300.0,
            'amount_total': 1300.0,
        }])

    def test_out_invoice_line_onchange_payment_terms(self):
        move_form = Form(self.env['account.move'].with_context(type='out_invoice'))
        move_form.invoice_date = fields.Date.from_string('2019-01-01')
        move_form.partner_id = self.partner_a
        with move_form.invoice_line_ids.new() as line_form:
            line_form.product_id = self.product_a
        with move_form.line_ids.edit(2) as line_form:
            # Edit the receivable line.
            line_form.account_id = self.parent_acc_receivable_2
            line_form.name = 'turlututu'
        move = move_form.save()

        self.assertRecordValues(move.invoice_line_ids, [
            {
                'name': 'product_a',
                'product_id': self.product_a.id,
                'account_id': self.parent_acc_revenue_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': self.uom_unit.id,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 1000.0,
                'price_subtotal': 1000.0,
                'price_total': 1150.0,
                'tax_ids': self.parent_tax_sale_1.ids,
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 1000.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': False,
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
        ])
        self.assertRecordValues(move.line_ids, [
            {
                'name': 'product_a',
                'product_id': self.product_a.id,
                'account_id': self.parent_acc_revenue_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': self.uom_unit.id,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 1000.0,
                'price_subtotal': 1000.0,
                'price_total': 1150.0,
                'tax_ids': self.parent_tax_sale_1.ids,
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 1000.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': False,
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
            {
                'name': self.parent_tax_sale_1.name,
                'product_id': False,
                'account_id': self.parent_tax_sale_1.account_id.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': False,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 150.0,
                'price_subtotal': 150.0,
                'price_total': 150.0,
                'tax_ids': [],
                'tax_line_id': self.parent_tax_sale_1.id,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 150.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': 'other',
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
            {
                'name': 'turlututu',
                'product_id': False,
                'account_id': self.parent_acc_receivable_2.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': False,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': -1150.0,
                'price_subtotal': -1150.0,
                'price_total': -1150.0,
                'tax_ids': [],
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 1150.0,
                'credit': 0.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': 'other',
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
        ])
        self.assertRecordValues(move, [{
            'amount_untaxed': 1000.0,
            'amount_tax': 150.0,
            'amount_total': 1150.0,
        }])

    def test_out_invoice_line_advance_edition_custom_aml(self):
        move_form = Form(self.env['account.move'].with_context(type='out_invoice'))
        move_form.invoice_date = fields.Date.from_string('2019-01-01')
        move_form.partner_id = self.partner_a
        with move_form.invoice_line_ids.new() as line_form:
            line_form.product_id = self.product_a
        with move_form.line_ids.new() as line_form:
            line_form.account_id = self.parent_acc_revenue_2
            line_form.debit = 500
            line_form.tax_ids.add(self.parent_tax_sale_1)
        move = move_form.save()

        self.assertRecordValues(move.invoice_line_ids, [
            {
                'name': 'product_a',
                'product_id': self.product_a.id,
                'account_id': self.parent_acc_revenue_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': self.uom_unit.id,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 1000.0,
                'price_subtotal': 1000.0,
                'price_total': 1150.0,
                'tax_ids': self.parent_tax_sale_1.ids,
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 1000.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': False,
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
            {
                'name': False,
                'product_id': False,
                'account_id': self.parent_acc_revenue_2.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': False,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': -500.0,
                'price_subtotal': -500.0,
                'price_total': -575.0,
                'tax_ids': self.parent_tax_sale_1.ids,
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 500.0,
                'credit': 0.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': False,
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
        ])
        self.assertRecordValues(move.line_ids, [
            {
                'name': 'product_a',
                'product_id': self.product_a.id,
                'account_id': self.parent_acc_revenue_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': self.uom_unit.id,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 1000.0,
                'price_subtotal': 1000.0,
                'price_total': 1150.0,
                'tax_ids': self.parent_tax_sale_1.ids,
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 1000.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': False,
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
            {
                'name': self.parent_tax_sale_1.name,
                'product_id': False,
                'account_id': self.parent_tax_sale_1.account_id.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': False,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': 75.0,
                'price_subtotal': 75.0,
                'price_total': 75.0,
                'tax_ids': [],
                'tax_line_id': self.parent_tax_sale_1.id,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 0.0,
                'credit': 75.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': 'other',
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
            {
                'name': '/',
                'product_id': False,
                'account_id': self.parent_acc_receivable_1.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': False,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': -575.0,
                'price_subtotal': -575.0,
                'price_total': -575.0,
                'tax_ids': [],
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 575.0,
                'credit': 0.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': 'other',
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
            {
                'name': False,
                'product_id': False,
                'account_id': self.parent_acc_revenue_2.id,
                'partner_id': self.partner_a.id,
                'product_uom_id': False,
                'quantity': 1.0,
                'discount': 0.0,
                'price_unit': -500.0,
                'price_subtotal': -500.0,
                'price_total': -575.0,
                'tax_ids': self.parent_tax_sale_1.ids,
                'tax_line_id': False,
                'currency_id': False,
                'amount_currency': 0.0,
                'debit': 500.0,
                'credit': 0.0,
                'analytic_account_id': False,
                'analytic_tag_ids': [],
                'display_type': False,
                'date_maturity': fields.Date.from_string('2019-01-01'),
            },
        ])
        self.assertRecordValues(move, [{
            'amount_untaxed': 500.0,
            'amount_tax': 75.0,
            'amount_total': 575.0,
        }])

    # def test_out_invoice_line_change_partner(self):
    #     move_form = self.get_move_form_with_product()
    #     move_form.partner_id = self.partner_b
    #     move = move_form.save()
    #     _logger.info("check payment_term")
    #     self.assertEquals(move.invoice_payment_term_id, self.payment_term_immediate)
    #     _logger.info("TODO: check when invoice_date change while not payment_term nor invoice_date_due")
    #     _logger.info("Check move.invoice_date_due")
    #     self.assertEquals(move.invoice_date_due, fields.Date.today())
    #     _logger.info("check move.move_line_ids.invoice_date_due")
    #     self.assertRecordValues(move.line_ids, [
    #         {"date_maturity": fields.Date.today()},
    #         {"date_maturity": fields.Date.today()},
    #         {"date_maturity": fields.Date.today()},
    #     ])
    #     self.assertEquals(move.fiscal_position_id, self.fiscal_position_a)
    #     self.assertEquals(move.invoice_line_ids[0].tax_ids, self.sale_tax_25percent)
    #     self.assertEquals(move.line_ids[0].tax_ids, self.sale_tax_25percent)
    #     self.assertRecordValues(move.line_ids, [
    #         {'credit': 1000.0, 'debit': 0, 'tax_ids': self.sale_tax_25percent.ids},
    #         {'credit': 250.0,  'debit': 0, 'tax_ids': []},
    #         {'credit': 0,      'debit': 1250.0, 'tax_ids': []},
    #     ])
    #     _logger.info("check the account to be the proper ones")
    #     self.assertEquals(move.line_ids[0].account_id, self.account_product_sale_2)
    #     self.assertEquals(move.line_ids[1].account_id, self.tax_account_received_2)
    #
    # def test_out_invoice_line_payment_term_pay_in_advance(self):
    #     # Force usage of payment terms 30% in advance.
    #     self.partner_a.property_payment_term_id = self.env.ref('account.account_payment_term_advance')
    #
    #     # Create the invoice with one line.
    #     move_form = Form(self.env['account.move'].with_context(type='out_invoice'))
    #     move_form.partner_id = self.partner_a
    #     with move_form.invoice_line_ids.new() as line_form:
    #         line_form.product_id = self.product_a
    #     move = move_form.save()
    #
    #     # Check values.
    #     expected_payment_terms = move.invoice_payment_term_id.compute(1150, date_ref=move.date, currency=move.currency_id)
    #     self.assertRecordValues(move.line_ids, [
    #         {
    #             'account_id': self.account_product_sale.id,
    #             'date_maturity': fields.Date.from_string(expected_payment_terms[1][0]),
    #             'debit': 0.0,
    #             'credit': 1000.0,
    #             'quantity': 1,
    #             'price_unit': 1000.0,
    #         },
    #         {
    #             'account_id': self.tax_account_received.id,
    #             'date_maturity': fields.Date.from_string(expected_payment_terms[1][0]),
    #             'debit': 0.0,
    #             'credit': 150.0,
    #             'quantity': 1,
    #             'price_unit': 150.0,
    #         },
    #         {
    #             'account_id': self.account_receivable.id,
    #             'date_maturity': fields.Date.from_string(expected_payment_terms[0][0]),
    #             'debit': 345.0,
    #             'credit': 0.0,
    #             'quantity': 1,
    #             'price_unit': -345.0,
    #         },
    #         {
    #             'account_id': self.account_receivable.id,
    #             'date_maturity': fields.Date.from_string(expected_payment_terms[1][0]),
    #             'debit': 805.0,
    #             'credit': 0.0,
    #             'quantity': 1,
    #             'price_unit': -805.0,
    #         },
    #     ])
    #
    # def test_out_invoice_line_change_payment_term_should_not_change_account_receivable(self):
    #     move_form = self.get_move_form_with_product()
    #     receivable_line = move_form.line_ids.edit(2)
    #     receivable_line.account_id = self.account_receivable_2
    #     receivable_line.save()
    #     move_form.invoice_payment_term_id = self.payment_term_immediate
    #     move = move_form.save()
    #     self.assertRecordValues(move.line_ids, [
    #         {'account_id': self.account_product_sale.id},
    #         {'account_id': self.tax_account_received.id},
    #         {'account_id': self.account_receivable_2.id},
    #     ])
    #
    # def test_out_invoice_line_check_currency(self):
    #     # Create the invoice with one line.
    #     move_form = Form(self.env['account.move'].with_context(type='out_invoice'))
    #     move_form.partner_id = self.partner_a
    #     with move_form.invoice_line_ids.new() as line_form:
    #         line_form.product_id = self.product_a
    #     move = move_form.save()
    #
    #     # Check the journal entry is well balanced using the company's currency.
    #     self.assertRecordValues(move.line_ids, [
    #         {
    #             'name': 'product_a', 'currency_id': False,
    #             'price_unit': 1000.0,   'debit': 0.0,       'credit': 1000.0,   'amount_currency': 0.0,
    #         },
    #         {
    #             'name': 'Tax 15.00%', 'currency_id': False,
    #             'price_unit': 150.0,    'debit': 0.0,       'credit': 150.0,    'amount_currency': 0.0,
    #         },
    #         {
    #             'name': '/', 'currency_id': False,
    #             'price_unit': -1150.0,  'debit': 1150.0,    'credit': 0.0,      'amount_currency': 0.0,
    #         },
    #     ])
    #
    #     # Change the currency.
    #     move_form = Form(move)
    #     move_form.currency_id = self.env.ref('base.EUR')
    #     move = move_form.save()
    #
    #     # Check the journal entry is well balanced using the company's currency.
    #     self.assertRecordValues(move.line_ids, [
    #         {
    #             'name': 'product_a', 'currency_id': move.currency_id.id,
    #             'price_unit': 1000.0,   'debit': 0.0,       'credit': 500.0,    'amount_currency': -1000.0,
    #         },
    #         {
    #             'name': 'Tax 15.00%', 'currency_id': move.currency_id.id,
    #             'price_unit': 150.0,    'debit': 0.0,       'credit': 75.0,     'amount_currency': -150.0,
    #         },
    #         {
    #             'name': '/', 'currency_id': move.currency_id.id,
    #             'price_unit': -1150.0,  'debit': 575.0,     'credit': 0.0,      'amount_currency': 1150.0,
    #         },
    #     ])
    #
    #     # Create a new line using the same product.
    #     move_form = Form(move)
    #     with move_form.invoice_line_ids.new() as line_form:
    #         line_form.product_id = self.product_a
    #     move = move_form.save()
    #
    #     # Check the product's standard price has been well converted to the journal entry's currency.
    #     self.assertRecordValues(move.line_ids, [
    #         {
    #             'name': 'product_a', 'currency_id': move.currency_id.id,
    #             'price_unit': 1000.0,   'debit': 0.0,       'credit': 500.0,    'amount_currency': -1000.0,
    #         },
    #         {
    #             'name': 'Tax 15.00%', 'currency_id': move.currency_id.id,
    #             'price_unit': 450.0,    'debit': 0.0,       'credit': 225.0,    'amount_currency': -450.0,
    #         },
    #         {
    #             'name': '/', 'currency_id': move.currency_id.id,
    #             'price_unit': -3450.0,  'debit': 1725.0,    'credit': 0.0,      'amount_currency': 3450.0,
    #         },
    #         {
    #             'name': 'product_a', 'currency_id': move.currency_id.id,
    #             'price_unit': 2000.0,   'debit': 0.0,       'credit': 1000.0,   'amount_currency': -2000.0,
    #         },
    #     ])
    #
    #     # Change the date.
    #     move_form = Form(move)
    #     move_form.date = fields.Date.from_string('2016-01-01')
    #     move = move_form.save()
    #
    #     # Check the currency conversion rate has changed.
    #     self.assertRecordValues(move.line_ids, [
    #         {
    #             'name': 'product_a', 'currency_id': move.currency_id.id,
    #             'price_unit': 1000.0,   'debit': 0.0,       'credit': 333.33,   'amount_currency': -1000.0,
    #         },
    #         {
    #             'name': 'Tax 15.00%', 'currency_id': move.currency_id.id,
    #             'price_unit': 450.0,    'debit': 0.0,       'credit': 150.0,    'amount_currency': -450.0,
    #         },
    #         {
    #             'name': '/', 'currency_id': move.currency_id.id,
    #             'price_unit': -3450.0,  'debit': 1150.0,    'credit': 0.0,      'amount_currency': 3450.0,
    #         },
    #         {
    #             'name': 'product_a', 'currency_id': move.currency_id.id,
    #             'price_unit': 2000.0,   'debit': 0.0,       'credit': 666.67,   'amount_currency': -2000.0,
    #         },
    #     ])
    #
    # def test_out_invoice_line_cash_rounding(self):
    #     rounding_add_line = self.env['account.cash.rounding'].create({
    #         'name': 'add_invoice_line',
    #         'rounding': 0.05,
    #         'strategy': 'add_invoice_line',
    #         'account_id': self.account_product_sale.id,
    #         'rounding_method': 'UP',
    #     })
    #     rounding_biggest_tax = self.env['account.cash.rounding'].create({
    #         'name': 'biggest_tax',
    #         'rounding': 0.05,
    #         'strategy': 'biggest_tax',
    #         'rounding_method': 'DOWN',
    #     })
    #
    #     # Create the invoice with one line.
    #     move_form = Form(self.env['account.move'].with_context(type='out_invoice'))
    #     move_form.partner_id = self.partner_a
    #     with move_form.invoice_line_ids.new() as line_form:
    #         line_form.product_id = self.product_a
    #         line_form.price_unit = 9.99
    #     move_form.invoice_cash_rounding_id = rounding_add_line
    #     move = move_form.save()
    #
    #     # Check the cash rounding (add_invoice_line) has been applied.
    #     self.assertRecordValues(move.line_ids, [
    #         {'name': 'product_a',               'debit': 0.0,   'credit': 9.99},
    #         {'name': 'Tax 15.00%',              'debit': 0.0,   'credit': 1.5},
    #         {'name': '/',                       'debit': 11.50, 'credit': 0.0},
    #         {'name': 'add_invoice_line',        'debit': 0.0,   'credit': 0.01},
    #     ])
    #
    #     # Change the cash rounding.
    #     move_form = Form(move)
    #     move_form.invoice_cash_rounding_id = rounding_biggest_tax
    #     move = move_form.save()
    #
    #     # Check the cash rounding (biggest_tax) has been applied.
    #     self.assertRecordValues(move.line_ids, [
    #         {'name': 'product_a',               'debit': 0.0,   'credit': 9.99},
    #         {'name': 'Tax 15.00%',              'debit': 0.0,   'credit': 1.5},
    #         {'name': '/',                       'debit': 11.45, 'credit': 0.0},
    #         {'name': 'Tax 15.00% (rounding)',   'debit': 0.04,  'credit': 0.0},
    #     ])
    #
    # def test_out_invoice_line_create(self):
    #     pass
    #
    # def test_out_invoice_line_add_note_line(self):
    #     pass
    #
    # def test_out_invoice_line_add_section_lines(self):
    #     pass
    #
    # def test_journal_entries_tax_lock_date(self):
    #     # Set the tax lock date at the end of the past last month.
    #     last_day_month = fields.Date.today().replace(day=1) - timedelta(days=1)
    #     self.env.user.company_id.tax_lock_date = last_day_month
    #
    #     # Create the journal entry with one line (date after the tax lock date).
    #     move_form = Form(self.env['account.move'].with_context(type='out_invoice'))
    #     move_form.partner_id = self.partner_a
    #     with move_form.invoice_line_ids.new() as line_form:
    #         line_form.product_id = self.product_a
    #         line_form.price_unit = 1000
    #     move = move_form.save()
    #
    #     # Edit the journal entry to set the date before the tax lock date.
    #     move_form = Form(move)
    #     move_form.date = last_day_month.replace(day=1)
    #
    #     # Changing debit / credit of tax lines is not allowed.
    #     with move_form.invoice_line_ids.edit(0) as line_form:
    #         line_form.price_unit = 2000
    #     with self.assertRaises(ValidationError):
    #         move_form.save()
    #
    #     # Changing the account is not allowed.
    #     with move_form.invoice_line_ids.edit(0) as line_form:
    #         line_form.price_unit = 1000
    #         line_form.account_id = self.account_product_sale_2
    #     with self.assertRaises(ValidationError):
    #         move_form.save()
    #
    #     # Changing the tax_ids is not allowed.
    #     with move_form.invoice_line_ids.edit(0) as line_form:
    #         line_form.account_id = self.account_product_sale
    #         line_form.tax_ids.clear()
    #     with self.assertRaises(ValidationError):
    #         move_form.save()
    #
    #     # Edit a journal entry to set the date before the tax lock date.
    #     self.env.user.company_id.tax_lock_date = False
    #     move_form = Form(move)
    #     move_form.date = last_day_month.replace(day=1)
    #     move = move_form.save()
    #     self.env.user.company_id.tax_lock_date = last_day_month
    #
    #     # Unlink the journal entry is not allowed before the tax lock date.
    #     with self.assertRaises(ValidationError):
    #         move.unlink()
    #
    #     # Edit the journal entry to set the date after the tax lock date.
    #     move_form = Form(move)
    #     move_form.date = fields.Date.today()
    #     move = move_form.save()
    #
    #     # Unlink the journal entry is now allowed.
    #     move.unlink()
