# -*- coding: utf-8 -*-
import logging
import io

from odoo import _, api, fields, models, tools, SUPERUSER_ID
from odoo.tools.pdf import OdooPdfFileReader, OdooPdfFileWriter

_logger = logging.getLogger(__name__)


class AccountMoveSend(models.Model):
    _inherit = 'account.move.send'

    enable_ubl_cii_xml = fields.Boolean(compute='_compute_send_mail_extra_fields')
    checkbox_ubl_cii_label = fields.Char(compute='_compute_checkbox_ubl_cii_label')
    checkbox_ubl_cii_xml = fields.Boolean(compute='_compute_checkbox_ubl_cii_xml', store=True, readonly=False)

    def _get_available_field_values_in_multi(self, move):
        # EXTENDS 'account'
        values = super()._get_available_field_values_in_multi(move)
        values['checkbox_ubl_cii_xml'] = self.checkbox_ubl_cii_xml
        return values

    # -------------------------------------------------------------------------
    # COMPUTE METHODS
    # -------------------------------------------------------------------------

    @api.depends('move_ids')
    def _compute_checkbox_ubl_cii_label(self):
        for wizard in self:
            wizard.checkbox_ubl_cii_label = False
            if wizard.mode in ('invoice_single', 'invoice_multi'):
                code_to_label = dict(wizard.move_ids.partner_id._fields['ubl_cii_format'].selection)
                codes = wizard.move_ids.partner_id.mapped('ubl_cii_format')
                if any(codes):
                    wizard.checkbox_ubl_cii_label = ", ".join(code_to_label[c] for c in set(codes) if c)

    def _compute_send_mail_extra_fields(self):
        # EXTENDS 'account'
        super()._compute_send_mail_extra_fields()
        for wizard in self:
            wizard.enable_ubl_cii_xml = any(m._get_default_enable_ubl_cii_xml() for m in wizard.move_ids)

    @api.depends('checkbox_ubl_cii_xml')
    def _compute_mail_attachments_widget(self):
        # EXTENDS 'account' - add depends
        super()._compute_mail_attachments_widget()

    @api.depends('enable_ubl_cii_xml')
    def _compute_checkbox_ubl_cii_xml(self):
        for wizard in self:
            wizard.checkbox_ubl_cii_xml = wizard.enable_ubl_cii_xml and wizard.company_id.invoice_is_ubl_cii

    # -------------------------------------------------------------------------
    # ATTACHMENTS
    # -------------------------------------------------------------------------

    @api.model
    def _get_invoice_extra_attachments(self, move):
        # EXTENDS 'account'
        return super()._get_invoice_extra_attachments(move) + move.ubl_cii_xml_id

    def _needs_ubl_cii_placeholder(self):
        return self.enable_ubl_cii_xml and self.checkbox_ubl_cii_xml

    def _get_placeholder_mail_attachments_data(self, move):
        # EXTENDS 'account'
        results = super()._get_placeholder_mail_attachments_data(move)

        if self.mode == 'invoice_single' and self._needs_ubl_cii_placeholder():
            builder = move.partner_id._get_edi_builder()
            filename = builder._export_invoice_filename(move)
            results.append({
                'id': f'placeholder_{filename}',
                'name': filename,
                'mimetype': 'application/xml',
                'placeholder': True,
            })

        return results

    # -------------------------------------------------------------------------
    # BUSINESS ACTIONS
    # -------------------------------------------------------------------------

    def _hook_invoice_document_before_pdf_report_render(self, invoice, invoice_data):
        # EXTENDS 'account'
        super()._hook_invoice_document_before_pdf_report_render(invoice, invoice_data)

        if self.mode == 'invoice_single' and self.checkbox_ubl_cii_xml and invoice._get_default_enable_ubl_cii_xml():
            builder = invoice.partner_id._get_edi_builder()
            xml_content, errors = builder._export_invoice(invoice)
            filename = builder._export_invoice_filename(invoice)

            # Failed.
            if errors:
                invoice_data['error'] = "".join([
                    _("Errors occured while creating the EDI document (format: %s):", builder._description),
                    "\n",
                    "<p><li>" + "</li><li>".join(errors) + "</li></p>" if self.mode == 'invoice_multi' \
                        else "\n".join(errors)
                ])
                invoice_data['error_but_continue'] = True
            else:
                invoice_data['ubl_cii_xml_attachment_values'] = {
                    'name': filename,
                    'raw': xml_content,
                    'mimetype': 'application/xml',
                    'res_model': invoice._name,
                    'res_id': invoice.id,
                    'res_field': 'ubl_cii_xml_file',  # Binary field
                }
                invoice_data['ubl_cii_xml_options'] = {
                    'ubl_cii_format': invoice.partner_id.ubl_cii_format,
                    'builder': builder,
                }

    def _hook_invoice_document_after_pdf_report_render(self, invoice, invoice_data):
        # EXTENDS 'account'
        super()._hook_invoice_document_after_pdf_report_render(invoice, invoice_data)

        edi_model = invoice.partner_id._get_edi_builder()
        if edi_model is None:
            edi_model = self.env['account.edi.xml.cii']

        # Add PDF to XML
        edi_model._postprocess_invoice_xml(invoice, invoice_data)
        # Always silently generate a Factur-X and embed it inside the PDF for inter-portability
        if invoice_data.get('ubl_cii_xml_options', {}).get('ubl_cii_format') == 'facturx':
            xml_facturx = invoice_data['ubl_cii_xml_attachment_values']['raw']
        else:
            xml_facturx = self.env['account.edi.xml.cii']._export_invoice(invoice)[0]

        # during tests, no wkhtmltopdf, create the attachment for test purposes
        if tools.config['test_enable']:
            self.env['ir.attachment'].create({
                'name': 'factur-x.xml',
                'raw': xml_facturx,
                'res_id': invoice.id,
                'res_model': 'account.move',
            })
            return

        # Read pdf content.
        reader_buffer = io.BytesIO(invoice_data['pdf_attachment_values']['raw'])
        reader = OdooPdfFileReader(reader_buffer, strict=False)

        # Post-process.
        writer = OdooPdfFileWriter()
        writer.cloneReaderDocumentRoot(reader)

        writer.addAttachment('factur-x.xml', xml_facturx, subtype='text/xml')

        # PDF-A.
        if invoice_data.get('ubl_cii_xml_options', {}).get('ubl_cii_format') == 'facturx' \
                and not writer.is_pdfa:
            try:
                writer.convert_to_pdfa()
            except Exception as e:
                _logger.exception("Error while converting to PDF/A: %s", e)

            # Extra metadata to be Factur-x PDF-A compliant.
            content = self.env['ir.qweb']._render(
                'account_edi_ubl_cii.account_invoice_pdfa_3_facturx_metadata',
                {
                    'title': invoice.name,
                    'date': fields.Date.context_today(self),
                },
            )
            writer.add_file_metadata(content.encode())

        # Replace the current content.
        writer_buffer = io.BytesIO()
        writer.write(writer_buffer)
        invoice_data['pdf_attachment_values']['raw'] = writer_buffer.getvalue()
        reader_buffer.close()
        writer_buffer.close()

    def _link_invoice_documents(self, invoice, invoice_data):
        # EXTENDS 'account'
        super()._link_invoice_documents(invoice, invoice_data)

        attachment_vals = invoice_data.get('ubl_cii_xml_attachment_values')
        if attachment_vals:
            self.env['ir.attachment'].with_user(SUPERUSER_ID).create(attachment_vals)
            invoice.invalidate_recordset(fnames=['ubl_cii_xml_id', 'ubl_cii_xml_file'])
