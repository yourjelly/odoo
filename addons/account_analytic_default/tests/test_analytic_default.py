# -*- coding: utf-8 -*-
from odoo.addons.account.tests.account_test_savepoint import AccountTestInvoicingCommon
from odoo.tests.common import Form
from odoo.tests import tagged


@tagged('post_install', '-at_install')
class TestAccountMoveOutInvoiceOnchanges(AccountTestInvoicingCommon):

    @classmethod
    def setUpClass(cls, chart_template_ref=None):
        super().setUpClass(chart_template_ref=chart_template_ref)

        cls.invoice = cls.init_invoice('out_invoice')

    def test_out_invoice_analytic_default(self):
        self.env.user.groups_id += self.env.ref('analytic.group_analytic_accounting')
        self.env.user.groups_id += self.env.ref('analytic.group_analytic_tags')

        analytic_account = self.env['account.analytic.account'].create([{
            'name': 'test_analytic_account_1',
            'code': 'TEST1'
        }, {
            'name': 'test_analytic_account_2',
            'code': 'TEST2'
        }])

        self.env['account.analytic.default'].create([{
            'partner_id': self.partner_a.id,
            'product_id': self.product_a.id,
            'analytic_id': analytic_account[0].id,
        }, {
            'partner_id': self.partner_a.id,
            'analytic_id': analytic_account[1].id,
        }])

        line_0 = self.invoice.invoice_line_ids[0]

        with Form(self.invoice) as move_form, move_form.invoice_line_ids.edit(0) as line_form:
            move_form.partner_id = self.partner_a
            # line_form.product_id = self.product_a
        self.assertEqual(line_0.analytic_account_id, analytic_account[0])

        with Form(self.invoice) as move_form, move_form.invoice_line_ids.edit(0) as line_form:
            line_form.product_id = self.product_b
        self.assertEqual(line_0.analytic_account_id, analytic_account[1])

        with Form(self.invoice) as move_form, move_form.invoice_line_ids.edit(0) as line_form:
            move_form.partner_id = self.partner_b
        self.assertEqual(line_form.analytic_account_id, analytic_account[1])

        with Form(self.invoice) as move_form, move_form.invoice_line_ids.edit(0) as line_form:
            move_form.partner_id = self.partner_a
            line_form.product_id = self.product_a
        self.assertEqual(line_0.analytic_account_id, analytic_account[0])

        with Form(self.invoice) as move_form, move_form.invoice_line_ids.edit(0) as line_form:
            line_form.analytic_account_id = self.env['account.analytic.account']
        self.assertEqual(line_0.analytic_account_id, self.env['account.analytic.account'])
