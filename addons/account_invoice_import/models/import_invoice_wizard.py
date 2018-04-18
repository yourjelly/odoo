# -*- coding: utf-8 -*-

from odoo import api, fields, models, _
from odoo.tools import pycompat

from lxml import etree
from PyPDF2 import PdfFileReader

import io
import base64


class ImportInvoiceWizard(models.TransientModel):
    _name = 'account.invoice.import'
    _description = 'Import Your Vendor Bills from XMLs Files.'

    attachment_ids = fields.Many2many('ir.attachment', 'xml_import_ir_attachments_rel',
        'xml_import_id', 'attachment_id', string='Attachments')

    @api.model
    def _get_xml_decoders(self):
        ''' List of usable decoders to extract invoice from attachments.

        :return: a list of triplet (xml_type, check_func, decode_func)
            * xml_type: The format name, e.g 'Factur-x'
            * check_func: A function taking an etree as parameter to check the file.
            * decode_func: A function taking an etree as parameter and returning an invoice record.
        '''
        # TO BE OVERWRITTEN
        return [('Factur-x', self.env['account.invoice']._is_facturx_tree, self.env['account.invoice']._import_facturx_invoice)]

    @api.model
    def _attachment_to_xmls(self, attachments):
        ''' An attachment could be an xml or a pdf with some embedded files.

        :param attachments: A list of ir.attachment or _Attachment namedtuple (see mail.thread).
        :return: A mapping of each attachment_id to a dictionary:
            * record: The browsed record.
            * xmls: list of tuple (<attachment_id>, <filename>, <xml_tree>).
        '''
        # Move to tools?

        def _get_attachment_id(attachment):
            # Handle both _Attachment namedtuple in mail.thread or ir.attachment.
            return hasattr(attachment, 'id') and attachment.id or False

        def _get_attachment_filename(attachment):
            # Handle both _Attachment namedtuple in mail.thread or ir.attachment.
            return hasattr(attachment, 'fname') and getattr(attachment, 'fname') or attachment.name

        def _get_attachment_content(attachment):
            # Handle both _Attachment namedtuple in mail.thread or ir.attachment.
            return hasattr(attachment, 'content') and getattr(attachment, 'content') or base64.b64decode(attachment.datas)

        res = {}
        for attachment in attachments:
            attachment_id = _get_attachment_id(attachment)

            res.setdefault(attachment_id, {'record': attachment, 'xmls': []})

            file_content = _get_attachment_content(attachment)

            try:
                reader = PdfFileReader(io.BytesIO(file_content))
            except:
                reader = None

            if reader:
                if reader.trailer['/Root'].get('/Names') and reader.trailer['/Root']['/Names'].get('/EmbeddedFiles'):
                    # Keep embedded attachments.
                    # N.B: embedded_files looks like:
                    # ['file.xml', {'/Type': '/Filespec', '/F': 'file.xml', '/EF': {'/F': IndirectObject(22, 0)}}]
                    embedded_files = reader.trailer['/Root']['/Names']['/EmbeddedFiles']['/Names']

                    # '[::2]' because it's a list [fn_1, content_1, fn_2, content_2, ..., fn_n, content_2]
                    for filename, content_obj in list(pycompat.izip(embedded_files, embedded_files[1:]))[::2]:
                        xml_content = content_obj.getObject()['/EF']['/F'].getData()
                        try:
                            xml_tree = etree.fromstring(xml_content)
                        except:
                            continue
                        res[attachment_id]['xmls'].append((filename, xml_tree))
            else:
                try:
                    xml_tree = etree.fromstring(file_content)
                except:
                    continue
                res[attachment_id]['xmls'].append((_get_attachment_filename(attachment), xml_tree))
        return res

    @api.model
    def get_js_attachment_types(self, attachment_ids):
        ''' Retrieve the xml data for the widget JS-side.

        :param attachment_ids: A list of ids.
        :return: A dictionary mapping each attachment id with the recognized format.
        '''
        res = {}
        attachments = self.env['ir.attachment'].browse(attachment_ids)
        decoders = self._get_xml_decoders()

        for attachment_res in self._attachment_to_xmls(attachments).values():
            xmls = attachment_res.get('xmls')
            attachment = attachment_res['record']

            if not xmls:
                continue

            for filename, xml_tree in xmls:
                for xml_type, check_func, decode_func in decoders:
                    if check_func(xml_tree):
                        res[attachment.id] = xml_type
                        break
        return res

    @api.multi
    def create_invoices(self):
        ''' Create the invoices from attachments.

        :return: A action redirecting to account.invoice tree/form view.
        '''
        if not self.attachment_ids:
            return

        invoices = self.env['account.invoice']
        decoders = self._get_xml_decoders()

        for attachment_res in self._attachment_to_xmls(self.attachment_ids).values():
            xmls = attachment_res.get('xmls')
            attachment = attachment_res['record']

            invoice = None
            if xmls:
                for filename, xml_tree in xmls:
                    for xml_type, check_func, decode_func in decoders:
                        if check_func(xml_tree):
                            invoice = decode_func(xml_tree)

            if not invoice:
                invoice = self.env['account.invoice']._create_new_empty_account_invoice()

            invoice.message_post(attachment_ids=[attachment.id])
            invoices += invoice

            # Link the attachment to the newly created invoice.
            attachment.write({
                'res_model': 'account.invoice',
                'res_id': invoice.id,
            })

        action_vals = {
            'name': _('Invoices'),
            'domain': [('id', 'in', invoices.ids)],
            'view_type': 'form',
            'res_model': 'account.invoice',
            'view_id': False,
            'type': 'ir.actions.act_window',
        }
        if len(invoices) == 1:
            action_vals.update({'res_id': invoices[0].id, 'view_mode': 'form'})
        else:
            action_vals['view_mode'] = 'tree,form'
        return action_vals
