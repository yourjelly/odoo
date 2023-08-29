# Part of Odoo. See LICENSE file for full copyright and licensing details.

import io

from PyPDF2 import PdfFileReader, PdfFileMerger, PdfFileWriter

from odoo import api, fields, models


class SaleOrder(models.Model):
    _inherit = 'sale.order'

    def _get_built_pdf(self):
        pdf_raw = self.env['ir.actions.report'].sudo()._render_qweb_pdf(
            'sale.action_report_saleorder',
            [self.id]
        )[0]

        order_template = self.sale_order_template_id
        record = order_template or self.company_id
        header = record.header
        footer = record.footer

        if not footer and not header:
            return pdf

        IrBinary = self.env['ir.binary']
        merger = PdfFileMerger()
        quote = PdfFileReader(io.BytesIO(pdf_raw))

        # TODO read from stream

        if header:
            quote_header = PdfFileReader(io.BytesIO(IrBinary._record_to_stream(record, 'header').read()))
            merger.append(quote_header)

        merger.append(quote)

        if footer:
            quote_footer = PdfFileReader(io.BytesIO(IrBinary._record_to_stream(record, 'footer').read()))
            merger.append(quote_footer)

        out_buff = io.BytesIO()
        merger.write(out_buff)
        return out_buff.getvalue()
