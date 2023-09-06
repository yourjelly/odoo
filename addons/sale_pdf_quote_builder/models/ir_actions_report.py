# -*- coding: utf-8 -*-
import io
from collections import OrderedDict
from zlib import error as zlib_error
from PyPDF2 import PdfReader, PdfMerger, PdfWriter
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
                header = record.sale_header
                footer = record.sale_footer

                # TODO edm: constraint to force PDF, on product & company / template
                if not header and not footer:
                    continue

                included_product_docs = self.env['product.document']
                for line in order.order_line:
                    document = line.product_id.product_document_ids | line.product_template_id.product_document_ids
                    doc_to_include = document.filtered(lambda d: d.attached_on == 'inside')
                    included_product_docs = included_product_docs | doc_to_include


                IrBinary = self.env['ir.binary']
                pdf_data = []
                if header:
                    pdf_data.append(IrBinary._record_to_stream(record, 'sale_header').read())

                for included_product_doc in included_product_docs:
                    pdf_data.append(IrBinary._record_to_stream(included_product_doc, 'datas').read())

                pdf_data.append((initial_stream).getvalue())

                if footer:
                    pdf_data.append(IrBinary._record_to_stream(record, 'sale_footer').read())

                try:
                    form_fields = {
                        'name': order.name,
                        'partner_id__name': order.partner_id.name,
                        'user_id__name': order.user_id.name,
                        'amount_untaxed': order.amount_untaxed,
                        'amount_total': order.amount_total,
                        'commitment_date': order.commitment_date,
                        'validity_date': order.validity_date and order.validity_date.strftime('%Y-%m-%d') or '',
                        'client_order_ref': order.client_order_ref or '',
                    }
                    stream = io.BytesIO(pdf.merge_pdf(pdf_data, form_fields))
                    result[order.id].update({'stream': stream})
                except (ValueError, PdfStreamError, PdfReadError, TypeError, zlib_error, NotImplementedError):
                    record._message_log(body=_(
                        "There was an error when trying to merge headers and footers to the "
                        "original PDF.\n Please make sure the source file are valid."
                    ))

        return result
