# -*- coding: utf-8 -*-
import io
import textwrap
from collections import OrderedDict

from odoo import models, _
from odoo.exceptions import UserError
from odoo.tools import pdf


class IrActionsReport(models.Model):
    _inherit = 'ir.actions.report'

    def _render_qweb_pdf_prepare_streams(self, data, res_ids=None):
        collected_streams = super()._render_qweb_pdf_prepare_streams(data, res_ids=res_ids)

        # Custom behavior for 'account.report_original_vendor_bill'.
        if self.report_name == 'account.report_original_vendor_bill':
            invoices = self.env['account.move'].browse(res_ids)
            if any(x.move_type not in ('in_invoice', 'in_receipt') for x in invoices):
                raise UserError(_("You can only print the original document for vendor bills."))

            original_attachments = invoices.message_main_attachment_id
            if not original_attachments:
                raise UserError(_("No original vendor bills could be found for any of the selected vendor bills."))

            collected_streams = OrderedDict()
            for invoice in invoices:
                attachment = invoice.message_main_attachment_id
                if attachment:
                    stream = io.BytesIO(attachment.raw)
                    if attachment.mimetype == 'application/pdf':
                        record = self.env[attachment.res_model].browse(attachment.res_id)
                        try:
                            stream = pdf.add_banner(stream, record.name, logo=True)
                        except ValueError:
                            raise UserError(_(
                                "Error when reading the original PDF for: %r.\nPlease make sure the file is valid.",
                                textwrap.shorten(record.name, width=100)
                            ))
                    collected_streams[invoice.id] = {
                        'stream': stream,
                        'attachment': attachment,
                    }

        # Generate EDIS and possibly embed them in the PDF
        if collected_streams \
                and res_ids \
                and len(res_ids) == 1 \
                and self.report_name in ('account.report_invoice_with_payments', 'account.report_invoice'):
            invoice = self.env['account.move'].browse(res_ids)
            if invoice.is_sale_document() and invoice.state != 'draft':
                # Add the attachments to the pdf file
                pdf_stream = collected_streams[invoice.id]['stream']

                # Read pdf content.
                pdf_content = pdf_stream.getvalue()
                reader_buffer = io.BytesIO(pdf_content)
                reader = pdf.OdooPdfFileReader(reader_buffer, strict=False)

                # Post-process and embed the additional files.
                writer = pdf.OdooPdfFileWriter()
                writer.cloneReaderDocumentRoot(reader)

                # Embed in pdf if needed
                for format in invoice.edi_format_ids:
                    attachment = data['edi_attachments'][invoice].get(format)
                    if attachment:
                        format._prepare_invoice_report(writer, attachment)

                # Replace the current content.
                pdf_stream.close()
                new_pdf_stream = io.BytesIO()
                writer.write(new_pdf_stream)
                collected_streams[invoice.id]['stream'] = new_pdf_stream

        return collected_streams

    def _render_qweb_pdf(self, res_ids=None, data=None, results=None):
        # Check for reports only available for invoices.
        if self.report_name in ('account.report_invoice_with_payments', 'account.report_invoice'):
            invoices = self.env['account.move'].browse(res_ids)
            if any(x.move_type == 'entry' for x in invoices):
                raise UserError(_("Only invoices could be printed."))

        # Generate the EDI now
        # keep track of the attachments generated in data: {'edi_attachments': {invoice: {format: attachment}}}
        if data:
            data['edi_attachments'] = {}
        else:
            data = {'edi_attachments': {}}

        for invoice in invoices:
            data['edi_attachments'][invoice] = {}
            if results and 'attachment_ids' not in results[invoice.id]:
                results[invoice.id]['attachment_ids'] = []
            for format in invoice.edi_format_ids:
                if format._when_is_edi_generated() == 'print':
                    print(f"...Generate xml for format: {format.name}")
                    res = format._post_invoice_edi(invoice)
                    attachment = res[invoice]['attachment']
                    data['edi_attachments'][invoice][format] = attachment

                    # link this attachment to the send & print wizard
                    if results and format.code != 'facturx_1_0_05':
                        results[invoice.id]['attachment_ids'].append(attachment.id)
        return super()._render_qweb_pdf(res_ids=res_ids, data=data, results=results)
