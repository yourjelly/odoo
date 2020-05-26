# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api
from odoo.exceptions import UserError
from odoo.tools.pdf import OdooPdfFileReader, OdooPdfFileWriter

from lxml import etree
import base64
import io
import logging

_logger = logging.getLogger(__name__)


class AccountEdiFormat(models.Model):
    _name = 'account.edi.format'
    _description = 'EDI format'

    name = fields.Char()
    code = fields.Char()
    hide_on_journal = fields.Selection([('import_export', 'Import/Export'), ('import', 'Import Only')], default='import_export', help='used to hide this EDI format on journals')
    has_web_service = fields.Boolean()

    _sql_constraints = [
        ('unique_code', 'unique (code)', 'This code already exists')
    ]

    ####################################################
    # Low-level methods
    ####################################################

    @api.model
    def create(self, vals):
        res = super().create(vals)

        journals = self.env['account.journal'].search([('type', 'in', ('sale', 'purchase'))])
        for journal in journals:
            if res._enable_edi_on_journal_by_default(journal):
                journal.edi_format_ids += res

        return res

    ####################################################
    # Export method to override based on EDI Format
    ####################################################

    def _is_invoice_edi_needed(self, invoice):
        """ Is the EDI necessary for this invoice ?
            (for example, some edi_format might be specific to some countries).

        :param invoice: The invoice.
        :returns:       True if this invoice needs to be exported in this format, False otherwise.
        """
        # TO OVERRIDE
        self.ensure_one()
        return True

    def _is_payment_edi_needed(self, payment):
        """ Is the EDI necessary for this payment ?

        :param invoice: The account.move representing the payment.
        :returns:       True if this payment needs to be exported in this format, False otherwise.
        """
        self.ensure_one()
        return False

    def _needs_web_services(self):
        """ Does this edi format needs webservices for generating the edi file ?
            If False, the file will be generated automatically.
            Can be overriden.

            :return: False if the edi file can be generated automatically.
        """
        self.ensure_one()
        return self.has_web_service

    def _enable_edi_on_journal_by_default(self, journal):
        """ Should the format be enabled by default on the journal ?

        :param journal: The journal
        :param company: The journal's company
        :returns:       True if this format should be enabled by default on the journal, False otherwise.
        """
        # TO OVERRIDE
        self.ensure_one()
        return journal.type in ['sale', 'purchase']

    def _embed_invoice_attachment_to_pdf(self):
        """ Does the documents of this format need to be embedded in the pdf.

            :return: True if the documents needs to be embedded, False otherwise.
        """
        # TO OVERRIDE
        return True

    def _post_invoice_edi(self, invoices):
        """ Create the file content representing the invoice (and calls webservices if necessary).

        :param invoice: A list of invoices to post.
        :returns:       A dictionary with the invoice as key and as value, another dictionary:
        * attachment:   The attachment representing the invoice in this edi_format if the edi was successfully posted.
        * error:        An error if the edi was not successfully posted.
        """
        # TO OVERRIDE
        self.ensure_one()
        return {}

    def _cancel_invoice_edi(self, invoices):
        """Calls the webservices to cancel the invoice of this document.

        :param documents: A list of invoices to cancel.
        :returns:         A dictionary with the invoice as key and as value:
                          - True if the invoice was successfully cancelled.
                          - False or the string of an error if the invoice was not cancelled.
        """
        # TO OVERRIDE
        self.ensure_one()
        return {invoice: True for invoice in invoices}  # By default, cancel succeeds doing nothing.

    def _post_payment_edi(self, payments_with_reconciled):
        """ Create the file content representing the payment (and calls webservices if necessary).

        :param payments_with_reconciled:   A list of tuples (payment, reconciled)
        * payment:                         The payment to post.
        * reconciled:                      The invoices that were reconciled with this payment.
        :returns:                          A dictionary with the payment as key and as value, another dictionary:
        * attachment:                      The attachment representing the payment in this edi_format if the edi was successfully posted.
        * error:                           An error if the edi was not successfully posted.
        """
        # TO OVERRIDE
        self.ensure_one()
        return {}

    def _cancel_payment_edi(self, moves):
        """Calls the webservices to cancel the payment of this document.

        :param moves:     A list of payments to cancel.
        :returns:         A dictionary with the payment as key and as value:
                          - True if the payment was successfully cancelled.
                          - False or the string of an error if the payment was not cancelled.
        """
        # TO OVERRIDE
        self.ensure_one()
        return {move: True for move in moves}  # By default, cancel succeeds doing nothing.

    ####################################################
    # Import methods to override based on EDI Format
    ####################################################

    def _create_invoice_from_xml_tree(self, filename, tree):
        """ Create a new invoice with the data inside the xml.

        :param filename: The name of the xml.
        :param tree:     The tree of the xml to import.
        :returns:        The created invoice.
        """
        # TO OVERRIDE
        self.ensure_one()
        return self.env['account.move']

    def _update_invoice_from_xml_tree(self, filename, tree, invoice):
        """ Update an existing invoice with the data inside the xml.

        :param filename: The name of the xml.
        :param tree:     The tree of the xml to import.
        :param invoice:  The invoice to update.
        :returns:        The updated invoice.
        """
        # TO OVERRIDE
        self.ensure_one()
        return self.env['account.move']

    def _create_invoice_from_pdf_reader(self, filename, reader):
        """ Create a new invoice with the data inside a pdf.

        :param filename: The name of the pdf.
        :param reader:   The OdooPdfFileReader of the pdf to import.
        :returns:        The created invoice.
        """
        # TO OVERRIDE
        self.ensure_one()

        return self.env['account.move']

    def _update_invoice_from_pdf_reader(self, filename, reader, invoice):
        """ Update an existing invoice with the data inside the pdf.

        :param filename: The name of the pdf.
        :param reader:   The OdooPdfFileReader of the pdf to import.
        :param invoice:  The invoice to update.
        :returns:        The updated invoice.
        """
        # TO OVERRIDE
        self.ensure_one()
        return self.env['account.move']

    ####################################################
    # Export Internal methods (not meant to be overridden)
    ####################################################

    def _embed_edis_to_pdf(self, pdf_content, invoice):
        """ Create the EDI document of the invoice and embed it in the pdf_content.

        :param pdf_content: the bytes representing the pdf to add the EDIs to.
        :param invoice: the invoice to generate the EDI from.
        :returns: the same pdf_content with the EDI of the invoice embed in it.
        """
        attachments = []
        for edi_format in self:
            edi_document = invoice.edi_document_ids.filtered(lambda d: d.edi_format_id == edi_format)
            if edi_format._embed_invoice_attachment_to_pdf():
                attachment = edi_document.attachment_id
                datas = base64.b64decode(attachment.with_context(bin_size=False).datas)
                attachments.append({'name': attachment.name, 'datas': datas})

        if attachments:
            # Add the attachments to the pdf file
            reader_buffer = io.BytesIO(pdf_content)
            reader = OdooPdfFileReader(reader_buffer)
            writer = OdooPdfFileWriter()
            writer.cloneReaderDocumentRoot(reader)
            for vals in attachments:
                writer.addAttachment(vals['name'], vals['datas'])
            buffer = io.BytesIO()
            writer.write(buffer)
            pdf_content = buffer.getvalue()
            reader_buffer.close()
            buffer.close()
        return pdf_content

    ####################################################
    # Import Internal methods (not meant to be overridden)
    ####################################################

    def _decode_xml(self, filename, content):
        """Decodes an xml into a list of one dictionary representing an attachment.

        :param filename:    The name of the xml.
        :param attachment:  The xml as a string.
        :returns:           A list with a dictionary.
        * filename:         The name of the attachment.
        * content:          The content of the attachment.
        * type:             The type of the attachment.
        * xml_tree:         The tree of the xml if type is xml.
        * pdf_reader:       The pdf_reader if type is pdf.
        """
        to_process = []
        try:
            xml_tree = etree.fromstring(content)
        except Exception as e:
            _logger.exception("Error when converting the xml content to etree: %s" % e)
            return to_process
        if len(xml_tree):
            to_process.append({
                'filename': filename,
                'content': content,
                'type': 'xml',
                'xml_tree': xml_tree,
            })
        return to_process

    def _decode_pdf(self, filename, content):
        """Decodes a pdf and unwrap sub-attachment into a list of dictionary each representing an attachment.

        :param filename:    The name of the pdf.
        :param content:     The bytes representing the pdf.
        :returns:           A list of dictionary for each attachment.
        * filename:         The name of the attachment.
        * content:          The content of the attachment.
        * type:             The type of the attachment.
        * xml_tree:         The tree of the xml if type is xml.
        * pdf_reader:       The pdf_reader if type is pdf.
        """
        to_process = []
        try:
            buffer = io.BytesIO(content)
            pdf_reader = OdooPdfFileReader(buffer)
        except Exception as e:
            # Malformed pdf
            _logger.exception("Error when reading the pdf: %s" % e)
            return to_process

        # Process embedded files.
        for xml_name, content in pdf_reader.getAttachments():
            to_process.extend(self._decode_xml(xml_name, content))

        # Process the pdf itself.
        to_process.append({
            'filename': filename,
            'content': content,
            'type': 'pdf',
            'pdf_reader': pdf_reader,
        })

        return to_process

    def _decode_attachment(self, attachment):
        """Decodes an ir.attachment and unwrap sub-attachment into a list of dictionary each representing an attachment.

        :param attachment:  An ir.attachment record.
        :returns:           A list of dictionary for each attachment.
        * filename:         The name of the attachment.
        * content:          The content of the attachment.
        * type:             The type of the attachment.
        * xml_tree:         The tree of the xml if type is xml.
        * pdf_reader:       The pdf_reader if type is pdf.
        """
        content = base64.b64decode(attachment.with_context(bin_size=False).datas)
        to_process = []

        if 'pdf' in attachment.mimetype:
            to_process.extend(self._decode_pdf(attachment.name, content))
        elif 'xml' in attachment.mimetype:
            to_process.extend(self._decode_xml(attachment.name, content))

        return to_process

    def _create_invoice_from_attachment(self, attachment):
        """Decodes an ir.attachment to create an invoice.

        :param attachment:  An ir.attachment record.
        :returns:           The invoice where to import data.
        """
        for file_data in self._decode_attachment(attachment):
            for edi_format in self:
                res = False
                if file_data['type'] == 'xml':
                    res = edi_format._create_invoice_from_xml_tree(file_data['filename'], file_data['xml_tree'])
                elif file_data['type'] == 'pdf':
                    res = edi_format._create_invoice_from_pdf_reader(file_data['filename'], file_data['pdf_reader'])
                    file_data['pdf_reader'].stream.close()
                if res:
                    if 'extract_state' in res:
                        # Bypass the OCR to prevent overwriting data when an EDI was succesfully imported.
                        # TODO : remove when we integrate the OCR to the EDI flow.
                        res.write({'extract_state': 'done'})
                    return res
        return self.env['account.move']

    def _update_invoice_from_attachment(self, attachment, invoice):
        """Decodes an ir.attachment to update an invoice.

        :param attachment:  An ir.attachment record.
        :returns:           The invoice where to import data.
        """
        for file_data in self._decode_attachment(attachment):
            for edi_format in self:
                res = False
                if file_data['type'] == 'xml':
                    res = edi_format._update_invoice_from_xml_tree(file_data['filename'], file_data['xml_tree'], invoice)
                elif file_data['type'] == 'pdf':
                    res = edi_format._update_invoice_from_pdf_reader(file_data['filename'], file_data['pdf_reader'], invoice)
                    file_data['pdf_reader'].stream.close()
                if res:
                    if 'extract_state' in res:
                        # Bypass the OCR to prevent overwriting data when an EDI was succesfully imported.
                        # TODO : remove when we integrate the OCR to the EDI flow.
                        res.write({'extract_state': 'done'})
                    return res
        return self.env['account.move']
