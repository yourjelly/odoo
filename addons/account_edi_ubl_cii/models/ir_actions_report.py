import io

from odoo import api, fields, models
from odoo.tools.pdf import OdooPdfFileReader, OdooPdfFileWriter


class IrActionsReport(models.Model):
    _inherit = 'ir.actions.report'

    def _is_invoice_report(self, report_ref):
        # EXTENDS account
        # allows to add factur-x.xml to custom PDF templates (comma separated list of template names)
        custom_templates = self.env['ir.config_parameter'].sudo().get_param('account.custom_templates_facturx_list', '')
        custom_templates = [report.strip() for report in custom_templates.split(',')]
        return super()._is_invoice_report(report_ref) or self._get_report(report_ref).report_name in custom_templates

    def _render_qweb_pdf_prepare_streams(self, report_ref, data, res_ids=None):
        # EXTENDS base
        collected_streams = super()._render_qweb_pdf_prepare_streams(report_ref, data, res_ids)

        if collected_streams \
                and res_ids \
                and len(res_ids) == 1 \
                and self._is_invoice_report(report_ref) \
                and not self.env.context.get('from_account_move_send'):  # only triggered from the 'print' action report

            invoice = self.env['account.move'].browse(res_ids)
            # Generate and embed Factur-X
            if invoice.is_sale_document() and invoice.state == 'posted':
                # Add the attachments to the pdf file
                pdf_stream = collected_streams[invoice.id]['stream']
                # Read pdf content.
                pdf_content = pdf_stream.getvalue()
                reader_buffer = io.BytesIO(pdf_content)
                reader = OdooPdfFileReader(reader_buffer, strict=False)
                # Post-process and embed the additional files.
                writer = OdooPdfFileWriter()
                writer.cloneReaderDocumentRoot(reader)
                # Generate and embed Factur-X
                xml_content, _errors = self.env['account.edi.xml.cii']._export_invoice(invoice)
                writer.addAttachment(name='factur-x.xml', data=xml_content, subtype='text/xml')
                # Replace the current content.
                pdf_stream.close()
                new_pdf_stream = io.BytesIO()
                writer.write(new_pdf_stream)
                collected_streams[invoice.id]['stream'] = new_pdf_stream

        return collected_streams
