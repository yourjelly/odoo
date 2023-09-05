# -*- coding: utf-8 -*-
import io
from collections import OrderedDict
from zlib import error as zlib_error
from PyPDF2 import PdfFileReader, PdfFileMerger, PdfFileWriter
try:
    from PyPDF2.errors import PdfStreamError, PdfReadError
except ImportError:
    from PyPDF2.utils import PdfStreamError, PdfReadError

from odoo import _, models
from odoo.exceptions import UserError
from odoo.tools import pdf


class IrActionsReport(models.Model):
    _inherit = 'ir.actions.report'

    def _render_qweb_pdf_prepare_streams(self, report_ref, data, res_ids=None):
        result = super()._render_qweb_pdf_prepare_streams(report_ref, data, res_ids=res_ids)
        if self._get_report(report_ref).report_name != 'sale.report_saleorder':
            return result

        orders = self.env['sale.order'].browse(res_ids)

        for order in orders:
            initial_stream = result[order.id]['stream']
            if initial_stream:
                order_template = order.sale_order_template_id
                record = order_template or order.company_id
                header = record.header
                footer = record.footer

                included_product_docs = self.env['product.document']
                for line in order.order_line:
                    document = line.product_id.product_document_ids or line.product_template_id.product_document_ids
                    doc_to_include = document.filtered(lambda d: d.attached_on == 'inside')
                    included_product_docs = included_product_docs | doc_to_include
                    # TODO edm: this code makes me bleed, working for now

                # TODO edm: constraint if not PDF, either on the product document or filter here

                if not header and not included_product_docs and not footer:
                    continue

                IrBinary = self.env['ir.binary']

                pdf_data = []
                if header:
                    pdf_data.append(IrBinary._record_to_stream(record, 'header').read())

                for included_product_doc in included_product_docs:
                    pdf_data.append(IrBinary._record_to_stream(included_product_doc, 'datas').read())

                pdf_data.append((initial_stream).getvalue())

                if footer:
                    pdf_data.append(IrBinary._record_to_stream(record, 'footer').read())

                try:
                    stream = io.BytesIO(pdf.merge_pdf(pdf_data))
                    result[order.id].update({'stream': stream})
                except (ValueError, PdfStreamError, PdfReadError, TypeError, zlib_error, NotImplementedError):
                    record._message_log(body=_(
                        "There was an error when trying to merge headers and footers to the "
                        "original PDF.\n Please make sure the source file are valid."
                    ))

        return result
