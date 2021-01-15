# -*- coding: utf-8 -*-
from odoo.addons.account.tests.common import AccountTestInvoicingCommon
from odoo import fields
from odoo.tests import Form, tagged

from collections import defaultdict


@tagged('post_install', '-at_install')
class TestAccountTaxDetail(AccountTestInvoicingCommon):
    ''' Test about the taxes computation stored using the account.tax.detail model for journal entries. '''

    @classmethod
    def setUpClass(cls, chart_template_ref=None):
        super().setUpClass(chart_template_ref=chart_template_ref)

        cls.fake_country = cls.env['res.country'].create({
            'name': "The Island of the Fly",
            'code': 'YY',
        })

        cls.tax_tags = cls.env['account.account.tag'].create({
            'name': 'tax_tag_%s' % str(i),
            'applicability': 'taxes',
            'country_id': cls.fake_country.id,
        } for i in range(6))

        cls.tax_10 = cls.env['account.tax'].create({
            'name': "tax_10",
            'amount': 10.0,
        })
        cls.tax_10_price_include = cls.env['account.tax'].create({
            'name': "tax_10_price_include",
            'amount': 10.0,
            'price_include': True,
            'include_base_amount': True,
        })
        cls.tax_15_fixed = cls.env['account.tax'].create({
            'name': "tax_15_fixed",
            'amount': 15.0,
            'amount_type': 'fixed',
        })
        cls.tax_20_multi_rep_lines = cls.env['account.tax'].create({
            'name': "tax_20_multi_rep_lines",
            'amount': 20.0,
            'invoice_repartition_line_ids': [
                (0, 0, {
                    'factor_percent': 100.0,
                    'repartition_type': 'base',
                    'tag_ids': [(6, 0, cls.tax_tags[0].ids)],
                }),
                (0, 0, {
                    'factor_percent': 40.0,
                    'repartition_type': 'tax',
                    'tag_ids': [(6, 0, cls.tax_tags[1].ids)],
                }),
                (0, 0, {
                    'factor_percent': 60.0,
                    'repartition_type': 'tax',
                    'tag_ids': [(6, 0, cls.tax_tags[2].ids)],
                }),
            ],
            'refund_repartition_line_ids': [
                (0, 0, {
                    'factor_percent': 100.0,
                    'repartition_type': 'base',
                    'tag_ids': [(6, 0, cls.tax_tags[3].ids)],
                }),
                (0, 0, {
                    'factor_percent': 40.0,
                    'repartition_type': 'tax',
                    'tag_ids': [(6, 0, cls.tax_tags[4].ids)],
                }),
                (0, 0, {
                    'factor_percent': 60.0,
                    'repartition_type': 'tax',
                    'tag_ids': [(6, 0, cls.tax_tags[5].ids)],
                }),
            ],
        })

    # -------------------------------------------------------------------------
    # HELPERS
    # -------------------------------------------------------------------------

    def _create_move(self, move_type, line_vals_list):
        one2many_field = 'line_ids' if move_type == 'entry' else 'invoice_line_ids'
        move_form = Form(self.env['account.move'].with_context(default_move_type=move_type))
        if move_type != 'entry':
            move_form.partner_id = self.partner_a
            move_form.invoice_date = fields.Date.from_string('2019-01-01')
            for line_vals in line_vals_list:
                if 'currency_id' in line_vals:
                    move_form.currency_id = line_vals.pop('currency_id')

        move_form.date = fields.Date.from_string('2019-01-01')
        for i, line_vals in enumerate(line_vals_list):
            with getattr(move_form, one2many_field).new() as line_form:
                line_form.sequence = 100 + i # Magic sequence to retrieve lines in 'assert_tax_details'.
                line_form.name = 'line %s' % i
                for k, v in line_vals.items():
                    if self.env['account.move.line']._fields[k].type == 'many2many':
                        getattr(line_form, k).clear()
                        for item in v:
                            getattr(line_form, k).add(item)
                    else:
                        setattr(line_form, k, v)
                if not line_form.account_id:
                    line_form.account_id = self.company_data['default_account_revenue']

        # Auto balance if necessary.
        balance = 0.0
        for line_command in move_form._values['line_ids']:
            line_vals = line_command[2]
            balance += line_vals['debit'] - line_vals['credit']
        if not self.env.company.currency_id.is_zero(balance):
            with move_form.line_ids.new() as line_form:
                line_form.name = 'auto-balance'
                line_form.account_id = self.company_data['default_account_receivable']
                if balance > 0.0:
                    line_form.credit = balance
                else:
                    line_form.debit = -balance
        return move_form.save()

    def _edit_tax_line(self, move, tax, delta_balance, delta_amount_currency):
        def create_update_command(line, balance, amount_currency):
            return (1, line.id, {
                'amount_currency': amount_currency,
                'debit': balance if balance > 0.0 else 0.0,
                'credit': -balance if balance < 0.0 else 0.0,
            })

        line1 = move.line_ids.filtered(lambda line: line.tax_line_id == tax)
        line2 = move.line_ids.filtered(lambda line: line.account_id.internal_type in ('receivable', 'payable'))
        move.write({'line_ids': [
            create_update_command(line1, line1.balance + delta_balance, line1.amount_currency + delta_amount_currency),
            create_update_command(line2, line2.balance - delta_balance, line2.amount_currency - delta_amount_currency),
        ]})

    def assert_tax_details(self, move, expected_tax_details_list):
        # Track all lines having at least one tax detail.

        lines_with_tax_detail = move.line_ids.filtered('tax_detail_ids')

        # Check the account.tax.detail values.

        for line, expected_tax_details in expected_tax_details_list:
            self.assertRecordValues(line.tax_detail_ids, expected_tax_details)
            lines_with_tax_detail -= line

        # Check there is no unexpected tax detail.

        if lines_with_tax_detail:
            self.assertRecordValues(lines_with_tax_detail, [{'tax_detail_ids': []}] * len(lines_with_tax_detail))

        # Ensure each tax line is exactly the sum of its account.tax.details.

        total_per_repartition_line = defaultdict(lambda: {
            'balance': 0.0,
            'amount_currency': 0.0,
        })
        for tax_detail in move.line_ids.tax_detail_ids:
            vals = total_per_repartition_line[tax_detail.tax_repartition_line_id]
            vals['balance'] += tax_detail.tax_amount
            vals['amount_currency'] += tax_detail.tax_amount_currency
        for tax_line in move.line_ids.filtered('tax_repartition_line_id'):
            vals = total_per_repartition_line[tax_line.tax_repartition_line_id]
            vals['balance'] -= tax_line.balance
            vals['amount_currency'] -= tax_line.amount_currency
        for rep_line, vals in total_per_repartition_line.items():
            self.assertAlmostEqual(vals['balance'], 0.0)
            self.assertAlmostEqual(vals['amount_currency'], 0.0)

    def _get_rep_line(self, tax, index=0, refund=False):
        field = 'refund_repartition_line_ids' if refund else 'invoice_repartition_line_ids'
        return tax[field].filtered(lambda rep_line: rep_line.repartition_type == 'tax').sorted('factor')[index]

    # -------------------------------------------------------------------------
    # TESTS
    # -------------------------------------------------------------------------

    def test_simple_case_single_currency(self):
        ''' Test the account.tax.details are well created and aggregated together. '''

        def assert_tax_details(move, sign, refund=False):
            self.assert_tax_details(move, [
                (move.line_ids.filtered(lambda line: len(line.tax_ids) == 2 and not line.tax_line_id), [
                    {
                        'tax_amount': sign * 10.0,
                        'tax_amount_currency': sign * 10.0,
                        'tax_base_amount': sign * 100.0,
                        'tax_base_amount_currency': sign * 100.0,
                        'tax_ids': self.tax_15_fixed.ids,
                        'tag_ids': [],
                        'tax_repartition_line_id': self._get_rep_line(self.tax_10_price_include, refund=refund).id,
                    },
                    {
                        'tax_amount': sign * 15.0,
                        'tax_amount_currency': sign * 15.0,
                        'tax_base_amount': sign * 110.0,
                        'tax_base_amount_currency': sign * 110.0,
                        'tax_ids': [],
                        'tag_ids': [],
                        'tax_repartition_line_id': self._get_rep_line(self.tax_15_fixed, refund=refund).id,
                    },
                ]),
                (move.line_ids.filtered(lambda line: len(line.tax_ids) == 1 and not line.tax_line_id), [
                    {
                        'tax_amount': sign * 16.0,
                        'tax_amount_currency': sign * 16.0,
                        'tax_base_amount': sign * 200.0,
                        'tax_base_amount_currency': sign * 200.0,
                        'tax_ids': [],
                        'tag_ids': self.tax_tags[4 if refund else 1].ids,
                        'tax_repartition_line_id': self._get_rep_line(self.tax_20_multi_rep_lines, index=0, refund=refund).id,
                    },
                    {
                        'tax_amount': sign * 24.0,
                        'tax_amount_currency': sign * 24.0,
                        'tax_base_amount': sign * 200.0,
                        'tax_base_amount_currency': sign * 200.0,
                        'tax_ids': [],
                        'tag_ids': self.tax_tags[5 if refund else 2].ids,
                        'tax_repartition_line_id': self._get_rep_line(self.tax_20_multi_rep_lines, index=1, refund=refund).id,
                    },
                ]),
            ])

        move = self._create_move('entry', [
            {'debit': 100.0, 'tax_ids': self.tax_10_price_include + self.tax_15_fixed},
            {'debit': 200.0, 'tax_ids': self.tax_20_multi_rep_lines},
        ])
        assert_tax_details(move, 1, refund=True)

        invoice = self._create_move('out_invoice', [
            {'price_unit': 110.0, 'tax_ids': self.tax_10_price_include + self.tax_15_fixed},
            {'price_unit': 200.0, 'tax_ids': self.tax_20_multi_rep_lines},
        ])
        assert_tax_details(invoice, -1)

        bill = self._create_move('in_invoice', [
            {'price_unit': 110.0, 'tax_ids': self.tax_10_price_include + self.tax_15_fixed},
            {'price_unit': 200.0, 'tax_ids': self.tax_20_multi_rep_lines},
        ])
        assert_tax_details(bill, 1)

    def test_manual_tax_line_edition(self):
        ''' Test the tax lines are well handling manual edition of amount and are able to create a custom
        account.tax.detail in order to store the difference.
        '''

        def assert_tax_details(move, sign, refund=False):
            self.assert_tax_details(move, [
                (move.line_ids.filtered('tax_ids'), [
                    {
                        'tax_amount': sign * 15.0,
                        'tax_amount_currency': sign * 15.0,
                        'tax_base_amount': sign * 100.0,
                        'tax_base_amount_currency': sign * 100.0,
                        'tax_ids': [],
                        'tag_ids': [],
                        'tax_repartition_line_id': self._get_rep_line(self.tax_15_fixed, refund=refund).id,
                    },
                ]),
                (move.line_ids.filtered('tax_line_id'), [
                    {
                        'tax_amount': sign * 5.0,
                        'tax_amount_currency': sign * 5.0,
                        'tax_base_amount': sign * 100.0,
                        'tax_base_amount_currency': sign * 100.0,
                        'tax_ids': [],
                        'tag_ids': [],
                        'tax_repartition_line_id': self._get_rep_line(self.tax_15_fixed, refund=refund).id,
                    },
                ]),
            ])

        move = self._create_move('entry', [{'debit': 100.0, 'tax_ids': self.tax_15_fixed}])
        self._edit_tax_line(move, self.tax_15_fixed, 5.0, 5.0)
        assert_tax_details(move, 1, refund=True)

        invoice = self._create_move('out_invoice', [{'price_unit': 100.0, 'tax_ids': self.tax_15_fixed}])
        self._edit_tax_line(invoice, self.tax_15_fixed, -5.0, -5.0)
        assert_tax_details(invoice, -1)

        bill = self._create_move('in_invoice', [{'price_unit': 100.0, 'tax_ids': self.tax_15_fixed}])
        self._edit_tax_line(bill, self.tax_15_fixed, 5.0, 5.0)
        assert_tax_details(bill, 1)

    def test_import_journal_entry_with_tax_lines(self):
        move = self.env['account.move'].create({
            'move_type': 'entry',
            'journal_id': self.company_data['default_journal_misc'].id,
            'date': '2019-01-01',
            'line_ids': [
                (0, 0, {
                    'name': 'base line',
                    'account_id': self.company_data['default_account_revenue'].id,
                    'currency_id': self.currency_data['currency'].id,
                    'amount_currency': 190.0,
                    'debit': 100.0,
                    'credit': 0.0,
                    'tax_ids': [(6, 0, self.tax_15_fixed.ids)],
                }),
                (0, 0, {
                    'name': 'tax line',
                    'account_id': self.company_data['default_account_revenue'].id,
                    'currency_id': self.currency_data['currency'].id,
                    'tax_repartition_line_id': self._get_rep_line(self.tax_15_fixed, refund=True).id,
                    'amount_currency': 25.0,
                    'debit': 13.0,
                    'credit': 0.0,
                }),
                (0, 0, {
                    'name': 'balance',
                    'account_id': self.company_data['default_account_receivable'].id,
                    'debit': 0.0,
                    'credit': 113.0,
                }),
            ],
        })

        self.assert_tax_details(move, [
            (move.line_ids.filtered('tax_ids'), [{
                'tax_amount': 7.8947367999999996, # 15.0 / (190.0 / 100.0)
                'tax_amount_currency': 15.0,
                'tax_base_amount': 100.0,
                'tax_base_amount_currency': 190.0,
                'tax_repartition_line_id': self._get_rep_line(self.tax_15_fixed, refund=True).id,
            }]),
            (move.line_ids.filtered('tax_line_id'), [{
                'tax_amount': 5.1052632, # 13.0 - 7.8947367999999996
                'tax_amount_currency': 10.0,
                'tax_base_amount': 100.0,
                'tax_base_amount_currency': 190.0,
                'tax_repartition_line_id': self._get_rep_line(self.tax_15_fixed, refund=True).id,
            }]),
        ])

    def test_rounding_issue_foreign_currency(self):
        move = self._create_move('entry', [{
            'currency_id': self.currency_data['currency'],
            'amount_currency': 123.456,
            'tax_ids': self.tax_20_multi_rep_lines,
        }])
        rep_line1 = self._get_rep_line(self.tax_20_multi_rep_lines, index=0, refund=True)
        rep_line2 = self._get_rep_line(self.tax_20_multi_rep_lines, index=1, refund=True)

        self.assert_tax_details(move, [
            (move.line_ids.filtered('tax_ids'), [
                {
                    'tax_amount': 4.93816,
                    'tax_amount_currency': 9.876,
                    'tax_base_amount': 61.73, # 123.456 / 2.0
                    'tax_base_amount_currency': 123.456,
                    'tax_ids': [],
                    'tag_ids': self.tax_tags[4].ids,
                    'tax_repartition_line_id': rep_line1.id,
                },
                {
                    'tax_amount': 7.40774,
                    'tax_amount_currency': 14.815,
                    'tax_base_amount': 61.73, # 123.456 / 2.0
                    'tax_base_amount_currency': 123.456,
                    'tax_ids': [],
                    'tag_ids': self.tax_tags[5].ids,
                    'tax_repartition_line_id': rep_line2.id,
                },
            ]),
            (move.line_ids.filtered(lambda line: line.tax_repartition_line_id == rep_line1), [
                {
                    'tax_amount': 0.00184,
                    'tax_amount_currency': 0.0,
                    'tax_base_amount': 61.73,
                    'tax_base_amount_currency': 123.456,
                    'tax_ids': [],
                    'tag_ids': self.tax_tags[4].ids,
                    'tax_repartition_line_id': rep_line1.id,
                },
            ]),
            (move.line_ids.filtered(lambda line: line.tax_repartition_line_id == rep_line2), [
                {
                    'tax_amount': 0.00226,
                    'tax_amount_currency': 0.0,
                    'tax_base_amount': 61.73,
                    'tax_base_amount_currency': 123.456,
                    'tax_ids': [],
                    'tag_ids': self.tax_tags[5].ids,
                    'tax_repartition_line_id': rep_line2.id,
                },
            ]),
        ])

    def test_rounding_issue_tax_calculation_round_per_line(self):
        move = self._create_move('entry', [
            {'credit': 0.15, 'tax_ids': self.tax_10},
            {'credit': 0.15, 'tax_ids': self.tax_10},
        ])

        self.assert_tax_details(move, [
            (move.line_ids.filtered('tax_ids')[0], [{
                'tax_amount_currency': -0.02,
                'tax_base_amount_currency': -0.15,
                'tax_repartition_line_id': self._get_rep_line(self.tax_10).id,
            }]),
            (move.line_ids.filtered('tax_ids')[1], [{
                'tax_amount_currency': -0.02,
                'tax_base_amount_currency': -0.15,
                'tax_repartition_line_id': self._get_rep_line(self.tax_10).id,
            }]),
        ])

    def test_rounding_issue_tax_calculation_round_globally(self):
        self.env.company.tax_calculation_rounding_method = 'round_globally'

        move = self._create_move('entry', [
            {'credit': 0.15, 'tax_ids': self.tax_10},
            {'credit': 0.15, 'tax_ids': self.tax_10},
        ])

        self.assert_tax_details(move, [
            (move.line_ids.filtered('tax_ids')[0], [{
                'tax_amount_currency': -0.015,
                'tax_base_amount_currency': -0.15,
                'tax_repartition_line_id': self._get_rep_line(self.tax_10).id,
            }]),
            (move.line_ids.filtered('tax_ids')[1], [{
                'tax_amount_currency': -0.015,
                'tax_base_amount_currency': -0.15,
                'tax_repartition_line_id': self._get_rep_line(self.tax_10).id,
            }]),
        ])
