# -*- coding: utf-8 -*-
from odoo import tools, _
from odoo.tests import common
import base64
import time
from odoo.modules.module import get_module_resource


class AccountEdiTestCommon(common.TransactionCase):
    def setUp(self):
        super().setUp()
        self.env.user.company_id = self.env['res.company'].create({'name': 'MyCompany'})
        self.env.user.company_id.country_id = self._get_country_id()
        self.env.ref('l10n_generic_coa.configurable_chart_template').try_loading()  # TODO delete this
        self.journal_id = self.env['account.journal'].search([('type', '=', 'purchase')], limit=1)
        self.partner_id = self.env['res.partner'].create({'name': 'TestUser', 'vat': '0123456789'})
        self.product_id = self.env['product.product'].create({'name': 'Test Product'})

        self.edi_format = self._get_edi_format()
        self.journal_id.edi_format_ids = self.edi_format  # TODO += ?

    def _get_edi_format(self):
        # TO OVERRIDE
        return self.env['account.edi.format'].create({
            'name': 'Test EDI format',
            'code': 'test_edi',
            'export_invoice': 'separated_attachment'
        })

    def _get_country_id(self):
        # TO OVERRIDE
        raise ValueError("Please set a country in your test")

    def update_invoice(self, module_name, filename, invoice):
        file_path = get_module_resource(module_name, 'test_file', filename)
        file = open(file_path, 'rb').read()

        attachment_id = self.env['ir.attachment'].create({
            'name': filename,
            'datas': base64.encodebytes(file),
            'res_id': invoice.id,
            'res_model': 'account.move',
        })

        invoice.message_post(attachment_ids=[attachment_id.id])

    def create_invoice(self, module_name, filename):
        file_path = get_module_resource(module_name, 'test_file', filename)
        file = open(file_path, 'rb').read()

        attachment_id = self.env['ir.attachment'].create({
            'name': filename,
            'datas': base64.encodebytes(file),
            'res_model': 'account.move',
        })

        journal_id = self.env['account.journal'].search([('type', '=', 'purchase')], limit=1)
        invoice = journal_id.with_context(default_move_type='in_invoice')._create_invoice_from_single_attachment(attachment_id)

    def create_and_post_invoice(self, edi_format):
        invoice = self.env['account.move'].create({
            'move_type': 'in_invoice',
            'partner_id': self.partner_id,
            'currency_id': self.env.ref("base.USD").id,
            'invoice_date': '%s-08-01' % time.strftime('%Y'),
            'date': '%s-08-01' % time.strftime('%Y'),
            'invoice_line_ids': [
                (0, 0, {'product_id': self.product_id.id, 'quantity': 1, 'price_unit': 50.0})
            ],
            'journal_id': self.journal_id.id  # TODO rather use a with_context(default_journal_or_something='purchase') ?
        })

        invoice.post()
        return invoice
