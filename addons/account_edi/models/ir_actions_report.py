# -*- coding: utf-8 -*-

import io

from odoo import models
from odoo.tools.pdf import OdooPdfFileReader, OdooPdfFileWriter


class IrActionsReport(models.Model):
    _inherit = 'ir.actions.report'

    def _render_qweb_pdf_prepare_streams(self, data, res_ids=None):
        # EXTENDS base
        collected_streams = super()._render_qweb_pdf_prepare_streams(data, res_ids=res_ids)

        if collected_streams \
                and res_ids \
                and len(res_ids) == 1 \
                and self.report_name in ('account.report_invoice_with_payments', 'account.report_invoice'):
            invoice = self.env['account.move'].browse(res_ids)
            if invoice.is_sale_document() and invoice.state != 'draft':
                to_embed = invoice.edi_document_ids
                # Add the attachments to the pdf file
                if to_embed:
                    pdf_stream = collected_streams[invoice.id]['stream']

                    # Read pdf content.
                    pdf_content = pdf_stream.getvalue()
                    reader_buffer = io.BytesIO(pdf_content)
                    reader = OdooPdfFileReader(reader_buffer, strict=False)

                    # Post-process and embed the additional files.
                    writer = OdooPdfFileWriter()
                    writer.cloneReaderDocumentRoot(reader)
                    for edi_document in to_embed:
                        if edi_document.edi_format_id._when_is_edi_generated() == 'print':
                            edi_document.state = 'to_send'
                            edi_document._process_documents_no_web_services()
                        edi_document.edi_format_id._prepare_invoice_report(writer, edi_document)

                    # Replace the current content.
                    pdf_stream.close()
                    new_pdf_stream = io.BytesIO()
                    writer.write(new_pdf_stream)
                    collected_streams[invoice.id]['stream'] = new_pdf_stream

        return collected_streams
