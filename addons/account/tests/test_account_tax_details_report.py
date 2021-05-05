# -*- coding: utf-8 -*-
from odoo.addons.account.tests.common import AccountTestInvoicingCommon
from odoo.tests import tagged
from odoo import fields, Command


@tagged('post_install', '-at_install')
class TestAccountTaxDetailsReport(AccountTestInvoicingCommon):

    def assertTotalAmounts(self, moves, report_lines):
        tax_lines = moves.line_ids.filtered('tax_line_id')
        for tax in tax_lines.tax_line_id:
            tax_amount = sum(tax_lines.filtered(lambda x: x.tax_line_id == tax).mapped('balance'))
            report_tax_amount = sum(report_lines.filtered(lambda x: x.tax_id == tax).mapped('tax_amount'))
            self.assertAlmostEqual(tax_amount, report_tax_amount)

    def test_affect_base_amount_1(self):
        tax_20_affect = self.env['account.tax'].create({
            'name': "tax_20_affect",
            'amount_type': 'percent',
            'amount': 20.0,
            'include_base_amount': True,
        })
        tax_10 = self.env['account.tax'].create({
            'name': "tax_10",
            'amount_type': 'percent',
            'amount': 10.0,
        })
        tax_5 = self.env['account.tax'].create({
            'name': "tax_5",
            'amount_type': 'percent',
            'amount': 5.0,
        })

        invoice = self.env['account.move'].create({
            'move_type': 'out_invoice',
            'partner_id': self.partner_a.id,
            'invoice_date': '2019-01-01',
            'invoice_line_ids': [
                Command.create({
                    'name': 'line1',
                    'account_id': self.company_data['default_account_revenue'].id,
                    'price_unit': 1000.0,
                    'tax_ids': [Command.set((tax_20_affect + tax_10 + tax_5).ids)],
                }),
                Command.create({
                    'name': 'line2',
                    'account_id': self.company_data['default_account_revenue'].id,
                    'price_unit': 1000.0,
                    'tax_ids': [Command.set(tax_10.ids)],
                }),
                Command.create({
                    'name': 'line3',
                    'account_id': self.company_data['default_account_revenue'].id,
                    'price_unit': 1000.0,
                    'tax_ids': [Command.set(tax_10.ids)],
                }),
                Command.create({
                    'name': 'line4',
                    'account_id': self.company_data['default_account_revenue'].id,
                    'price_unit': 2000.0,
                    'tax_ids': [Command.set((tax_20_affect + tax_10).ids)],
                }),
            ]
        })
        base_lines = invoice.invoice_line_ids
        tax_lines = invoice.line_ids.filtered('tax_line_id').sorted(lambda x: (x.tax_line_id, len(x.tax_ids)))
        report_lines = self.env['account.tax.details.report']\
            .search([('company_id', '=', self.env.company.id)])\
            .sorted(lambda x: (x.base_line_id, x.tax_line_id, -abs(x.base_amount), -abs(x.tax_amount)))

        expected_report_line_values = [
            {
                'base_line_id': base_lines[0].id,
                'tax_line_id': tax_lines[0].id,
                'base_amount': -1000.0,
                'tax_amount': -200.0,
            },
            {
                'base_line_id': base_lines[0].id,
                'tax_line_id': tax_lines[1].id,
                'base_amount': -1000.0,
                'tax_amount': -100.0,
            },
            {
                'base_line_id': base_lines[0].id,
                'tax_line_id': tax_lines[1].id,
                'base_amount': -200.0,
                'tax_amount': -20.0,
            },
            {
                'base_line_id': base_lines[0].id,
                'tax_line_id': tax_lines[2].id,
                'base_amount': -1000.0,
                'tax_amount': -50.0,
            },
            {
                'base_line_id': base_lines[0].id,
                'tax_line_id': tax_lines[2].id,
                'base_amount': -200.0,
                'tax_amount': -10.0,
            },
            {
                'base_line_id': base_lines[1].id,
                'tax_line_id': tax_lines[1].id,
                'base_amount': -1000.0,
                'tax_amount': -100.0,
            },
            {
                'base_line_id': base_lines[2].id,
                'tax_line_id': tax_lines[1].id,
                'base_amount': -1000.0,
                'tax_amount': -100.0,
            },
            {
                'base_line_id': base_lines[3].id,
                'tax_line_id': tax_lines[3].id,
                'base_amount': -2000.0,
                'tax_amount': -400.0,
            },
            {
                'base_line_id': base_lines[3].id,
                'tax_line_id': tax_lines[1].id,
                'base_amount': -2000.0,
                'tax_amount': -200.0,
            },
            {
                'base_line_id': base_lines[3].id,
                'tax_line_id': tax_lines[1].id,
                'base_amount': -400.0,
                'tax_amount': -40.0,
            },
        ]

        self.assertRecordValues(report_lines, expected_report_line_values)
        self.assertTotalAmounts(invoice, report_lines)

        # Same with a group of taxes

        tax_group = self.env['account.tax'].create({
            'name': "tax_group",
            'amount_type': 'group',
            'children_tax_ids': [Command.set((tax_20_affect + tax_10 + tax_5).ids)],
        })

        invoice.write({
            'invoice_line_ids': [Command.update(base_lines[0].id, {
                'tax_ids': [Command.set(tax_group.ids)],
            })],
        })

        self.assertRecordValues(report_lines, expected_report_line_values)
        self.assertTotalAmounts(invoice, report_lines)

    def test_affect_base_amount_2(self):
        taxes_10_affect = self.env['account.tax'].create([{
            'name': "tax_10_affect_%s" % i,
            'amount_type': 'percent',
            'amount': 10.0,
            'include_base_amount': True,
        } for i in range(3)])

        invoice = self.env['account.move'].create({
            'move_type': 'out_invoice',
            'partner_id': self.partner_a.id,
            'invoice_date': '2019-01-01',
            'invoice_line_ids': [
                Command.create({
                    'name': 'line1',
                    'account_id': self.company_data['default_account_revenue'].id,
                    'price_unit': 1000.0,
                    'tax_ids': [Command.set(taxes_10_affect.ids)],
                }),
                Command.create({
                    'name': 'line2',
                    'account_id': self.company_data['default_account_revenue'].id,
                    'price_unit': 1000.0,
                    'tax_ids': [Command.set((taxes_10_affect[0] + taxes_10_affect[2]).ids)],
                }),
            ]
        })
        base_lines = invoice.invoice_line_ids
        tax_lines = invoice.line_ids.filtered('tax_line_id').sorted(lambda x: (x.tax_line_id, len(x.tax_ids)))
        report_lines = self.env['account.tax.details.report']\
            .search([('company_id', '=', self.env.company.id)])\
            .sorted(lambda x: (x.base_line_id, x.tax_line_id, -abs(x.base_amount), -abs(x.tax_amount)))

        self.assertRecordValues(
            report_lines,
            [
                {
                    'base_line_id': base_lines[0].id,
                    'tax_line_id': tax_lines[0].id,
                    'base_amount': -1000.0,
                    'tax_amount': -100.0,
                },
                {
                    'base_line_id': base_lines[0].id,
                    'tax_line_id': tax_lines[1].id,
                    'base_amount': -1000.0,
                    'tax_amount': -100.0,
                },
                {
                    'base_line_id': base_lines[0].id,
                    'tax_line_id': tax_lines[1].id,
                    'base_amount': -100.0,
                    'tax_amount': -10.0,
                },
                {
                    'base_line_id': base_lines[0].id,
                    'tax_line_id': tax_lines[2].id,
                    'base_amount': -1000.0,
                    'tax_amount': -100.0,
                },
                {
                    'base_line_id': base_lines[0].id,
                    'tax_line_id': tax_lines[2].id,
                    'base_amount': -110.0,
                    'tax_amount': -11.0,
                },
                {
                    'base_line_id': base_lines[0].id,
                    'tax_line_id': tax_lines[2].id,
                    'base_amount': -110.0,
                    'tax_amount': -11.0,
                },
                {
                    'base_line_id': base_lines[1].id,
                    'tax_line_id': tax_lines[2].id,
                    'base_amount': -1000.0,
                    'tax_amount': -100.0,
                },
                {
                    'base_line_id': base_lines[1].id,
                    'tax_line_id': tax_lines[2].id,
                    'base_amount': -110.0,
                    'tax_amount': -11.0,
                },
                {
                    'base_line_id': base_lines[1].id,
                    'tax_line_id': tax_lines[2].id,
                    'base_amount': -100.0,
                    'tax_amount': -10.0,
                },
            ],
        )
        self.assertTotalAmounts(invoice, report_lines)

    def test_affect_base_amount_3(self):
        eco_tax = self.env['account.tax'].create({
            'name': "eco_tax",
            'amount_type': 'fixed',
            'amount': 5.0,
            'include_base_amount': True,
        })
        tax_20 = self.env['account.tax'].create({
            'name': "tax_20",
            'amount_type': 'percent',
            'amount': 20.0,
        })

        invoice = self.env['account.move'].create({
            'move_type': 'out_invoice',
            'partner_id': self.partner_a.id,
            'invoice_date': '2019-01-01',
            'invoice_line_ids': [
                Command.create({
                    'name': 'line1',
                    'account_id': self.company_data['default_account_revenue'].id,
                    'price_unit': 95.0,
                    'tax_ids': [Command.set((eco_tax + tax_20).ids)],
                }),
            ]
        })
        base_lines = invoice.line_ids.filtered('tax_ids')
        tax_lines = invoice.line_ids.filtered('tax_line_id').sorted(lambda x: (x.tax_line_id, len(x.tax_ids)))
        report_lines = self.env['account.tax.details.report'].search([('company_id', '=', self.env.company.id)])

        self.assertRecordValues(
            report_lines,
            [
                {
                    'base_line_id': base_lines[0].id,
                    'tax_line_id': tax_lines[0].id,
                    'base_amount': -95.0,
                    'tax_amount': -5.0,
                },
                {
                    'base_line_id': base_lines[0].id,
                    'tax_line_id': tax_lines[1].id,
                    'base_amount': -95.0,
                    'tax_amount': -19.0,
                },
                {
                    'base_line_id': base_lines[1].id,
                    'tax_line_id': tax_lines[1].id,
                    'base_amount': -5.0,
                    'tax_amount': -1.0,
                },
            ],
        )
        self.assertTotalAmounts(invoice, report_lines)

    def test_round_globally_rounding(self):
        self.env.company.tax_calculation_rounding_method = 'round_globally'

        tax_50 = self.env['account.tax'].create({
            'name': "tax_50",
            'amount_type': 'percent',
            'amount': 50.0,
        })

        invoice = self.env['account.move'].create({
            'move_type': 'out_invoice',
            'partner_id': self.partner_a.id,
            'invoice_date': '2019-01-01',
            'invoice_line_ids': [
                Command.create({
                    'name': 'line%s' % i,
                    'account_id': self.company_data['default_account_revenue'].id,
                    'price_unit': 0.01,
                    'tax_ids': [Command.set(tax_50.ids)],
                })
            for i in range(7)]
        })
        base_lines = invoice.line_ids.filtered('tax_ids')
        tax_lines = invoice.line_ids.filtered('tax_line_id')
        report_lines = self.env['account.tax.details.report'].search([('company_id', '=', self.env.company.id)])

        self.assertRecordValues(
            report_lines,
            [
                {
                    'base_line_id': base_lines[0].id,
                    'tax_line_id': tax_lines.id,
                    'base_amount': -0.01,
                    'tax_amount': -0.01,
                },
                {
                    'base_line_id': base_lines[1].id,
                    'tax_line_id': tax_lines.id,
                    'base_amount': -0.01,
                    'tax_amount': 0.0,
                },
                {
                    'base_line_id': base_lines[2].id,
                    'tax_line_id': tax_lines.id,
                    'base_amount': -0.01,
                    'tax_amount': -0.01,
                },
                {
                    'base_line_id': base_lines[3].id,
                    'tax_line_id': tax_lines.id,
                    'base_amount': -0.01,
                    'tax_amount': 0.00,
                },
                {
                    'base_line_id': base_lines[4].id,
                    'tax_line_id': tax_lines.id,
                    'base_amount': -0.01,
                    'tax_amount': -0.01,
                },
                {
                    'base_line_id': base_lines[5].id,
                    'tax_line_id': tax_lines.id,
                    'base_amount': -0.01,
                    'tax_amount': 0.0,
                },
                {
                    'base_line_id': base_lines[6].id,
                    'tax_line_id': tax_lines.id,
                    'base_amount': -0.01,
                    'tax_amount': -0.01,
                },
            ],
        )
        self.assertTotalAmounts(invoice, report_lines)

    def test_partitioning_lines_by_moves(self):
        tax_20_affect = self.env['account.tax'].create({
            'name': "tax_20_affect",
            'amount_type': 'percent',
            'amount': 20.0,
            'include_base_amount': True,
        })
        tax_10 = self.env['account.tax'].create({
            'name': "tax_10",
            'amount_type': 'percent',
            'amount': 10.0,
        })

        invoices = self.env['account.move']
        expected_values_list = []
        for i in range(1, 6):
            invoice = invoices.create({
                'move_type': 'out_invoice',
                'partner_id': self.partner_a.id,
                'invoice_date': '2019-01-01',
                'invoice_line_ids': [
                    Command.create({
                        'name': 'line1',
                        'account_id': self.company_data['default_account_revenue'].id,
                        'price_unit': i * 1000.0,
                        'tax_ids': [Command.set((tax_20_affect + tax_10).ids)],
                    }),
                ]
            })
            invoices |= invoice
            base_lines = invoice.line_ids.filtered('tax_ids')
            tax_lines = invoice.line_ids.filtered('tax_line_id')
            expected_values_list += [
                {
                    'base_line_id': base_lines[0].id,
                    'tax_line_id': tax_lines[0].id,
                    'base_amount': -1000.0 * i,
                    'tax_amount': -200.0 * i,
                },
                {
                    'base_line_id': base_lines[0].id,
                    'tax_line_id': tax_lines[1].id,
                    'base_amount': -1000.0 * i,
                    'tax_amount': -100.0 * i,
                },
                {
                    'base_line_id': base_lines[1].id,
                    'tax_line_id': tax_lines[1].id,
                    'base_amount': -200.0 * i,
                    'tax_amount': -20.0 * i,
                },
            ]

        report_lines = self.env['account.tax.details.report'].search([('company_id', '=', self.env.company.id)])
        self.assertRecordValues(report_lines, expected_values_list)
        self.assertTotalAmounts(invoices, report_lines)
