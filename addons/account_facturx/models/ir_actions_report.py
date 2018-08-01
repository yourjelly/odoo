# -*- coding: utf-8 -*-

from odoo import models, fields, api, release, _
from odoo.tools import DEFAULT_SERVER_DATE_FORMAT, DEFAULT_SERVER_DATETIME_FORMAT, pdf

from PyPDF2 import PdfFileReader

import io

DEFAULT_PDF_DATETIME_FORMAT = "D:%Y%m%d%H%M%S+00'00'"


class IrActionsReport(models.Model):
    _inherit = 'ir.actions.report'

    @api.model
    def postprocess_pdf_report(self, record, buffer):
        # OVERRIDE
        # Embed the Factur-x xml file inside the invoice report document.
        if record._name == 'account.invoice' and record.type in ('out_invoice', 'out_refund') and record.state != 'draft':
            xml_content = record._export_as_facturx_xml()

            # Create pdf metadata.
            type_name = dict(record._fields['type']._description_selection(record.env)).get(record.type)
            keywords = '%s, Factur-X' % type_name
            subject = 'Factur-X %s %s dated %s issued by %s' % \
                      (type_name, record.number, record.date_invoice, record.partner_id.name)
            title = '%s: %s %s' % (record.partner_id.name, type_name, record.number)
            pdf_metadata = {
                '/Author': record.partner_id.name,
                '/Keywords': keywords,
                '/Title': title,
                '/Subject': subject,
            }

            # Add attachment.
            writer = pdf.OdooPdfFileWriter(reader=pdf.OdooPdfFileReader(buffer), metadata=pdf_metadata)
            writer.addAttachments([{'filename': 'factur-x.xml', 'content': xml_content, 'subtype': '/text#2Fxml'}])

            # Add attachment metadata.
            facturx_metadata = self.env.ref('account_facturx.embedded_facturx_file_metadata').render({'metadata': writer.getMetadata()})
            facturx_metadata = u'<?xpacket begin="\ufeff" id="W5M0MpCehiHzreSzNTczkc9d"?>%s<?xpacket end="w"?>'.encode('utf-8') % facturx_metadata

            writer.addAttachmentsMetadata(facturx_metadata, subtype='/XML')

            buffer = io.BytesIO()
            writer.write(buffer)
        return super(IrActionsReport, self).postprocess_pdf_report(record, buffer)
