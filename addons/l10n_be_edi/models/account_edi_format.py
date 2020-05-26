# -*- coding: utf-8 -*-

from odoo import api, models, fields
from odoo.tools import float_repr

import base64


class AccountEdiFormat(models.Model):
    _inherit = 'account.edi.format'

    def _is_efff(self, filename, tree):
        return self.code == 'efff_1' and tree.tag == '{urn:oasis:names:specification:ubl:schema:xsd:Invoice-2}Invoice'

    def _create_invoice_from_xml_tree(self, filename, tree):
        self.ensure_one()
        if self._is_efff(filename, tree):
            return self._import_ubl(tree, self.env['account.move'])
        return super()._create_invoice_from_xml_tree(filename, tree)

    def _update_invoice_from_xml_tree(self, filename, tree, invoice):
        self.ensure_one()
        if self._is_efff(filename, tree):
            return self._import_ubl(tree, invoice)
        return super()._update_invoice_from_xml_tree(filename, tree, invoice)

    def _enable_edi_on_journal_by_default(self, journal):
        self.ensure_one()
        if self.code != 'efff_1':
            return super()._enable_edi_on_journal_by_default(journal)
        return journal.type in ['sale', 'purchase'] and journal.company_id.country_id == self.env.ref('base.be')

    def _post_invoice_edi(self, invoices):
        self.ensure_one()
        if self.code != 'efff_1':
            return super()._post_invoice_edi(invoices)
        res = {}
        for invoice in invoices:
            attachment = self._export_efff(invoice)
            res[invoice] = {'attachment': attachment}
        return res

    def _export_efff(self, invoice):
        self.ensure_one()
        # Create file content.
        xml_content = b"<?xml version='1.0' encoding='UTF-8'?>"
        xml_content += self.env.ref('account_edi_ubl.export_ubl_invoice')._render(invoice._get_ubl_values())
        vat = invoice.company_id.partner_id.commercial_partner_id.vat
        xml_name = 'efff-%s%s%s.xml' % (vat or '', '-' if vat else '', invoice.name.replace('/', '_'))  # official naming convention
        return self.env['ir.attachment'].create({
            'name': xml_name,
            'datas': base64.encodebytes(xml_content),
            'res_model': 'account.move',
            'res_id': invoice._origin.id,
            'mimetype': 'application/xml'
        })

    def _embed_invoice_attachment_to_pdf(self):
        self.ensure_one()
        if self.code != 'efff_1':
            return super()._embed_invoice_attachment_to_pdf()
        return False  # ubl must not be embedded to PDF.
