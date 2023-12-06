# -*- coding: utf-8 -*-
import base64
import logging
import io

from lxml import etree
from xml.sax.saxutils import escape, quoteattr

from odoo import _, api, fields, models, tools, SUPERUSER_ID

_logger = logging.getLogger(__name__)


class AccountMoveSend(models.TransientModel):
    _inherit = 'account.move.send'

    l10n_pl_edi_ksef_enable_xml = fields.Boolean(compute='_compute_l10n_pl_edi_ksef_enable_xml')
    l10n_pl_edi_ksef_checkbox_xml = fields.Boolean(compute='_compute_l10n_pl_edi_ksef_checkbox_xml', store=True, readonly=False)

    @api.depends('move_ids')
    def _compute_l10n_pl_edi_ksef_enable_xml(self):
        for wizard in self:
            wizard.l10n_pl_edi_ksef_enable_xml = any(move._l10n_pl_edi_ksef_get_default_enable() for move in wizard.move_ids)

    @api.depends('l10n_pl_edi_ksef_enable_xml')
    def _compute_l10n_pl_edi_ksef_checkbox_xml(self):
        for wizard in self:
            wizard.l10n_pl_edi_ksef_checkbox_xml = wizard.l10n_pl_edi_ksef_enable_xml

    def _get_wizard_values(self):
        # EXTENDS 'account'
        values = super()._get_wizard_values()
        values['l10n_pl_edi_ksef_xml'] = self.l10n_pl_edi_ksef_checkbox_xml
        return values

    @api.model
    def _get_invoice_extra_attachments(self, move):
        # EXTENDS 'account'
        return super()._get_invoice_extra_attachments(move) + move.l10n_pl_edi_ksef_xml_id

    def _get_placeholder_mail_attachments_data(self, move):
        # EXTENDS 'account'
        results = super()._get_placeholder_mail_attachments_data(move)

        if self.mode == 'invoice_single' and self.l10n_pl_edi_ksef_enable_xml and self.l10n_pl_edi_ksef_checkbox_xml:
            filename = move._l10n_pl_edi_ksef_get_filename()
            results.append({
                'id': f'placeholder_{filename}',
                'name': filename,
                'mimetype': 'application/xml',
                'placeholder': True,
            })

        return results

    @api.model
    def _hook_invoice_document_before_pdf_report_render(self, invoice, invoice_data):
        # EXTENDS 'account'
        super()._hook_invoice_document_before_pdf_report_render(invoice, invoice_data)

        if invoice_data.get('l10n_pl_edi_ksef_xml') and invoice._l10n_pl_edi_ksef_get_default_enable():
            xml_content, errors = invoice._l10n_pl_edi_render_xml()
            if errors:
                invoice_data['error'] = {
                    'error_title': _("Errors occurred while creating the EDI document (format: %s):", "Ksef"),
                    'errors': errors,
                }
            else:
                invoice_data['l10n_pl_edi_ksef_attachment_values'] = {
                    'name': invoice._l10n_pl_edi_ksef_get_filename(),
                    'raw': xml_content,
                    'mimetype': 'application/xml',
                    'res_model': invoice._name,
                    'res_id': invoice.id,
                    'res_field': 'l10n_pl_edi_ksef_xml_file',  # Binary field
                }

    @api.model
    def _link_invoice_documents(self, invoice, invoice_data):
        # EXTENDS 'account'
        super()._link_invoice_documents(invoice, invoice_data)

        attachment_vals = invoice_data.get('l10n_pl_edi_ksef_attachment_values')
        if attachment_vals:
            self.env['ir.attachment'].with_user(SUPERUSER_ID).create(attachment_vals)
            invoice.invalidate_recordset(fnames=['l10n_pl_edi_ksef_xml_id', 'l10n_pl_edi_ksef_xml_file'])

    @api.model
    def _call_web_service_after_invoice_pdf_render(self, invoices_data):
        # Overrides 'account'
        moves = self.env['account.move']
        attachments_vals = {}
        for move, move_data in invoices_data.items():
            if move_data.get('l10n_pl_edi_ksef_xml'):
                moves |= move
                if attachment := move.l10n_pl_edi_ksef_xml_id:
                    attachments_vals[move] = {'name': attachment.name, 'raw': attachment.raw}
                else:
                    attachments_vals[move] = invoices_data[move]['l10n_pl_edi_ksef_attachment_values']
        moves._l10n_pl_edi_send(attachments_vals)
