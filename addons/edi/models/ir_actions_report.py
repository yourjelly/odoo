# -*- coding: utf-8 -*-
import io

from odoo import models, fields, api, _
from odoo.tools.pdf import OdooPdfFileReader, OdooPdfFileWriter


class IrActionsReport(models.Model):
    _inherit = 'ir.actions.report'

    def _post_pdf(self, save_in_attachment, pdf_content=None, res_ids=None):
        # OVERRIDE
        if res_ids and len(res_ids) == 1 and pdf_content and self.model and 'edi.mixin' in self.env[self.model]._inherits:
            record = self.env[self.model].browse(res_ids)
            pdf_report_ids = record._get_edi_pdf_report_ids()
            if self.id in pdf_report_ids:
                edi_documents = record.edi_document_ids
                if edi_documents:
                    reader_buffer = io.BytesIO(pdf_content)
                    reader = OdooPdfFileReader(reader_buffer, strict=False)
                    writer = OdooPdfFileWriter()
                    writer.cloneReaderDocumentRoot(reader)
                    for edi_document in edi_documents:
                        record._edi_prepare_to_export_pdf(self, writer, edi_document)
                    buffer = io.BytesIO()
                    writer.write(buffer)
                    pdf_content = buffer.getvalue()
                    reader_buffer.close()
                    buffer.close()

        return super()._post_pdf(save_in_attachment, pdf_content=pdf_content, res_ids=res_ids)
