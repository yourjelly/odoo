# -*- coding: utf-8 -*-
from odoo import tools, _
from odoo.addons.account.tests.common import AccountTestInvoicingCommon
import base64
from odoo.modules.module import get_module_resource
from odoo.tests import tagged, Form

@tagged('post_install', '-at_install')
class TestUBL(AccountTestInvoicingCommon):
    def setUp(self):
        super(TestUBL, self).setUp()
        self.env.company.write({
            'chart_template_id': self.env.ref('l10n_be.l10nbe_chart_template').id
        })
        self.company_data = self.setup_company_data('MyCompany', country_id=self.env.ref('base.be').id)
        self.company = self.company_data['company']
        partner_form = Form(self.env['res.partner'])
        partner_form.name = 'Partner A'
        partner_form.vat = 'BE0123456789'
        self.partner_id = partner_form.save()

    def test_ubl_invoice_import(self):
        xml_file_path = get_module_resource('l10n_be_edi', 'test_xml_file', 'efff_test.xml')
        xml_file = open(xml_file_path, 'rb').read()
        move_form = Form(self.env['account.move'].with_context(default_move_type='in_invoice'))
        invoice = move_form.save()

        attachment_id = self.env['ir.attachment'].create({
            'name': 'efff_test.xml',
            'datas': base64.encodebytes(xml_file),
            'res_id': invoice.id,
            'res_model': 'account.move',
        })

        invoice.message_post(attachment_ids=[attachment_id.id])

        self.assertEqual(invoice.amount_total, 666.50)
        self.assertEqual(invoice.amount_tax, 115.67)
        self.assertEqual(invoice.partner_id, self.partner_id)
