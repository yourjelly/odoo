# -*- coding: utf-8 -*-

from odoo import api, models
from odoo.tools.pdf import OdooPdfFileReader

from lxml import etree

import io
import base64
import logging

_logger = logging.getLogger(__name__)


class AccountMove(models.Model):
    _inherit = 'account.move'

    @api.model
    def _get_xml_decoders(self):
        ''' List of usable decoders to extract invoice from attachments.

        :return: a list of triplet (xml_type, check_func, decode_func)
            * xml_type: The format name, e.g 'UBL 2.1'
            * check_func: A function detecting if the etree match the current format.
            * decode_func: A function taking an etree as parameter and returning an invoice record.
        '''
        # TO BE OVERWRITTEN
        return []

    def _create_invoice_from_attachment(self, attachment):
        ''' Generic method decoding the ir.attachment record passed as parameter in order to create an invoice.
        :param attachment:  An ir.attachment record.
        '''
        if 'pdf' in attachment.mimetype:
            for move in self:
                move._create_invoice_from_pdf(attachment)
        if 'xml' in attachment.mimetype:
            for move in self:
                move._create_invoice_from_xml(attachment)

    def _create_invoice_from_xml_file(self, filename, content, base64=True):
        ''' Generic method used to decode the content of an xml file passed as parameter in order to create an invoice.
        :param filename:    The filename of the xml file.
        :param content:     The content of the xml file as str or base64-encoded depending the 'base64' flag.
        :param base64:      A boolean to be set as True if 'content' is base64-encoded.
        :return:            The newly created invoice or an empty recordset.
        '''
        content = base64 and base64.b64decode(content) or content
        decoders = self._get_xml_decoders()
        invoice = self.env['account.move']

        try:
            tree = etree.fromstring(content)
        except Exception as e:
            _logger.exception("Error when converting the xml content to etree: %s" % e)
            return invoice

        for xml_type, check_func, decode_func in decoders:
            accept_decoder = check_func(tree, filename).get('flag')

            if not accept_decoder:
                continue

            try:
                invoice = decode_func(tree)
                if invoice:
                    invoice._remove_ocr_option()
                    break
            except Exception as e:
                _logger.exception("Error during the decoding of the %s format: %s" % (xml_type, e))
        return invoice

    def _create_invoice_from_xml_attachment(self, attachment):
        ''' Same as '_create_invoice_from_xml_file' using an ir.attachment record.
        :param attachment:  An ir.attachment record.
        :return:            The newly created invoice or an empty recordset.
        '''
        return self._create_invoice_from_xml_file(attachment.name, attachment.datas)

    def _create_invoice_from_pdf(self, attachment):
        ''' Generic method used to parse a pdf in order to create an invoice.
        This method also takes care about embedded files inside the document.
        :param attachment:  An ir.attachment record.
        :return:            The newly created invoice or an empty recordset.
        '''
        content = base64.b64decode(attachment.datas)
        invoice = self.env['account.move']

        with io.BytesIO(content) as buffer:
            try:
                reader = OdooPdfFileReader(buffer)
                for embedded_file in reader.getAttachments():
                    filename = embedded_file['filename']
                    content = embedded_file['content']

                    invoice = self._create_invoice_from_xml_file(filename, content)
                    if invoice:
                        break
            except Exception as e:
                # Malformed pdf
                _logger.exception("Error when reading the pdf: %s" % e)
        return invoice

    def _remove_ocr_option(self):
        if 'extract_state' in self:
            self.write({'extract_state': 'done'})

    def _embed_edi_files_in_report(self):
        ''' Hook triggered at the generation of invoice's report and allowing to embed some xml files inside the pdf.
        :return: A list of tuple (filename, content as str)
        '''
        self.ensure_one()
        return []

    @api.returns('mail.message', lambda value: value.id)
    def message_post(self, **kwargs):
        # OVERRIDE
        # /!\ 'default_res_id' in self._context is used to don't process attachment when using a form view.
        res = super(AccountMove, self).message_post(**kwargs)

        if not self.env.context.get('no_new_invoice') and len(self) == 1 and self.state == 'draft' and (
            self.env.context.get('default_type', self.type) in self.env['account.move'].get_invoice_types(include_receipts=True)
            or self.env['account.journal'].browse(self.env.context.get('default_journal_id')).type in ('sale', 'purchase')
        ):
            for attachment in self.env['ir.attachment'].browse(kwargs.get('attachment_ids', [])):
                self._create_invoice_from_attachment(attachment)
        return res
