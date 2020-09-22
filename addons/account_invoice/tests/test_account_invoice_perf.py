# -*- coding: utf-8 -*-
from odoo.addons.account.tests.common import AccountTestInvoicingCommon
from odoo.tests.common import Form
from odoo.tests import tagged
from odoo import fields

import time


@tagged('post_install', '-at_install')
class TestAccountInvoicePerf(AccountTestInvoicingCommon):

    @classmethod
    def setUpClass(cls, chart_template_ref=None):
        super().setUpClass(chart_template_ref=chart_template_ref)

        cls.benchmark = [10, 20, 30, 40, 50, 100]

    def print_perf_report(self, title, perf_report):
        first_column_size = max(len(str(first_col)) for first_col, measure in perf_report) + 2

        print("Performance analysis of: %s" % title)
        for first_col, measure in perf_report:
            c1_content = first_col.ljust(first_column_size)
            c2_content = str(measure)
            print('%s| %s' % (c1_content, c2_content))

    def test_account_invoice_perf(self):
        perf_report = []

        invoice_form = Form(self.env['account.invoice'].sudo().with_context(default_invoice_type='out_invoice'))
        invoice_form.partner_id = self.partner_a
        invoice_form.invoice_date = fields.Date.from_string('2019-01-01')
        start = time.time()
        nb_lines = list(self.benchmark)
        for i in range(self.benchmark[-1]):
            index = i + 1
            print('Line #%s' % index)
            with invoice_form.invoice_line_ids.new() as line_form:
                line_form.product_id = self.product_a
            if index == nb_lines[0]:
                perf_report.append((str(index), time.time() - start))
                nb_lines = nb_lines[1:]
        invoice_form.save()
        perf_report.append(('create', time.time() - start))

        self.print_perf_report('account.invoice', perf_report)

    def test_account_move_perf(self):
        perf_report = []

        invoice_form = Form(self.env['account.move'].sudo().with_context(default_move_type='out_invoice'))
        invoice_form.partner_id = self.partner_a
        invoice_form.invoice_date = fields.Date.from_string('2019-01-01')
        start = time.time()
        nb_lines = list(self.benchmark)
        for i in range(self.benchmark[-1]):
            index = i + 1
            print('Line #%s' % index)
            with invoice_form.invoice_line_ids.new() as line_form:
                line_form.product_id = self.product_a
            if index == nb_lines[0]:
                perf_report.append((str(index), time.time() - start))
                nb_lines = nb_lines[1:]
        invoice_form.save()
        perf_report.append(('create', time.time() - start))

        self.print_perf_report('account.move', perf_report)
