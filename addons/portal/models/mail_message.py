# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields,models
from odoo.osv import expression


class MailMessage(models.Model):
    _inherit = 'mail.message'

    @api.model
    def default_get(self, fields_list):
        defaults = super(MailMessage, self).default_get(fields_list)
        # Note: explicitly implemented in default_get() instead of field default,
        # to avoid setting to True for all existing messages during upgrades.
        # TODO: this default should probably be dynamic according to the model
        # on which the messages are attached, thus moved to create().
        if 'website_published' in fields_list:
            defaults.setdefault('website_published', True)

        return defaults

    website_published = fields.Boolean(string='Published', help="Visible on the website as a comment")

    @api.model
    def _non_employee_message_domain(self):
        return [('subtype_id', '!=', False), ('subtype_id.internal', '=', False)]

    def portal_message_format(self):
        return self._portal_message_format([
            'id', 'body', 'date', 'author_id', 'email_from',  # base message fields
            'message_type', 'subtype_id', 'subject',  # message specific
            'model', 'res_id', 'record_name',  # document related
        ])

    def _portal_message_format(self, fields_list):
        message_values = self.read(fields_list)
        message_tree = dict((m.id, m) for m in self.sudo())
        self._message_read_dict_postprocess(message_values, message_tree)
        IrAttachmentSudo = self.env['ir.attachment'].sudo()
        for message in message_values:
            for attachment in message.get('attachment_ids', []):
                if not attachment.get('access_token'):
                    attachment['access_token'] = IrAttachmentSudo.browse(attachment['id']).generate_access_token()[0]
        return message_values

   