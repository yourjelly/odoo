# -*- coding: utf-8 -*-

from odoo import models, fields, api, _
from odoo.tools.pdf import OdooPdfFileReader, OdooPdfFileWriter

import io


class IrActionsReport(models.Model):
    _inherit = 'ir.actions.report'

    def _post_pdf(self, save_in_attachment, pdf_content=None, res_ids=None):
        # OVERRIDE to embed some EDI documents inside the PDF.
        if self.model == 'account.move' and res_ids and len(res_ids) == 1:
            invoice = self.env['account.move'].browse(res_ids)
            if invoice.is_sale_document() and invoice.state != 'draft':
                to_embed = invoice._embed_edi_files_in_report()

                if to_embed:
                    reader_buffer = io.BytesIO(pdf_content)
                    reader = OdooPdfFileReader(reader_buffer)
                    writer = OdooPdfFileWriter()
                    writer.cloneReaderDocumentRoot(reader)
                    for filename, content in to_embed:
                        writer.addAttachment(filename, content)
                    buffer = io.BytesIO()
                    writer.write(buffer)
                    pdf_content = buffer.getvalue()

                    reader_buffer.close()
                    buffer.close()
        return super(IrActionsReport, self)._post_pdf(save_in_attachment, pdf_content=pdf_content, res_ids=res_ids)
