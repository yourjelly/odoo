# -*- coding: utf-8 -*-
from odoo import tools, _
from odoo.tests import common
import base64
import time
from odoo.modules.module import get_module_resource

from odoo.addons.account_edi.tests.common import AccountEdiTestCommon


class TestFacturx(AccountEdiTestCommon):

    def _get_edi_format(self):
        return self.env.ref('account_edi_facturx.edi_facturx_1_0_05')

    def _get_country_id(self):
        return self.env.ref('base.fr')

    def test_invoice_edi_pdf(self):
        invoice = self.env['account.move'].with_context(default_move_type='in_invoice').create({})
        invoice_count = len(self.env['account.move'].search([]))
        self.update_invoice('account_edi_facturx', 'test_facturx.pdf', invoice)

        self.assertEqual(len(self.env['account.move'].search([])), invoice_count)
        self.assertEqual(invoice.amount_total, 525)

        self.create_invoice('account_edi_facturx', 'test_facturx.pdf')

        self.assertEqual(invoice.amount_total, 525)
        self.assertEqual(len(self.env['account.move'].search([])), invoice_count + 1)

    def test_invoice_edi_xml(self):
        invoice = self.env['account.move'].with_context(default_move_type='in_invoice').create({})
        invoice_count = len(self.env['account.move'].search([]))
        self.update_invoice('account_edi_facturx', 'test_facturx.xml', invoice)

        self.assertEqual(len(self.env['account.move'].search([])), invoice_count)
        self.assertEqual(invoice.amount_total, 4610)

        self.create_invoice('account_edi_facturx', 'test_facturx.xml')

        self.assertEqual(invoice.amount_total, 4610)
        self.assertEqual(len(self.env['account.move'].search([])), invoice_count + 1)

    def test_invoice_edi_export(self):
        invoice = self.create_and_post_invoice(self.edi_format)
        document = invoice.edi_document_ids.filtered(lambda d: d.edi_format_id == self.edi_format)
        datas = document.attachment_id.with_context(bin_size=False).datas
        datas = base64.b64decode(datas)

        self.assertIn(b'<udt:DateTimeString>20200801</udt:DateTimeString>', datas)
        self.assertIn(b'<ram:LineTotalAmount currencyID="USD">50.00</ram:LineTotalAmount>', datas)
