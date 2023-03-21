# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models
from odoo.tools.pdf import OdooPdfFileReader, OdooPdfFileWriter
import io


class IrActionsReport(models.Model):
    _inherit = 'ir.actions.report'

    def _render_qweb_pdf_prepare_streams(self, report_ref, data, res_ids=None):
        # EXTENDS base
        collected_streams = super()._render_qweb_pdf_prepare_streams(report_ref, data, res_ids=res_ids)

        if not collected_streams \
                or not res_ids \
                or len(res_ids) != 1 \
                or self.env.context.get('skip_add_facturx') \
                or self._get_report(report_ref).report_name not in ('account.report_invoice_with_payments', 'account.report_invoice'):
            return collected_streams

        invoice = self.env['account.move'].browse(res_ids)
        if invoice.is_sale_document() and invoice.state == 'posted':
            pdf_stream = collected_streams[invoice.id]['stream']

            # Read pdf content.
            pdf_content = pdf_stream.getvalue()
            reader_buffer = io.BytesIO(pdf_content)
            reader = OdooPdfFileReader(reader_buffer, strict=False)

            writer = OdooPdfFileWriter()
            writer.cloneReaderDocumentRoot(reader)

            # Always generate the Factur-X to ensure consistency with the PDF
            xml_content = self.env['account.edi.xml.cii']._export_invoice(invoice)[0]

            writer.addAttachment(
                name=self.env['account.edi.xml.cii']._export_invoice_filename(invoice),
                data=xml_content,
                subtype='text/xml',
            )

            # Replace the current content.
            pdf_stream.close()
            new_pdf_stream = io.BytesIO()
            writer.write(new_pdf_stream)
            collected_streams[invoice.id]['stream'] = new_pdf_stream

        return collected_streams
