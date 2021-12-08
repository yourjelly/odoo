# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class MailMessage(models.Model):
    _inherit = 'mail.message'

    def portal_message_format(self):
        return self._portal_message_format([
            'id', 'body', 'date', 'author_id', 'email_from',  # base message fields
            'message_type', 'subtype_id', 'is_internal', 'subject',  # message specific
            'model', 'res_id', 'record_name',  # document related
        ])

    def _portal_message_format(self, fields_list):
        vals_list = self._message_format(fields_list, attachments_options={'access_token': True})
        return vals_list

    def _message_format_iteration(self, vals, thread_ids_by_model_name, attachments_options, format_reply):
        super(MailMessage, self)._message_format_iteration(vals, thread_ids_by_model_name, attachments_options, format_reply)
        message_sudo = self.browse(vals['id']).sudo().with_prefetch(self.ids)
        vals['subtype_internal'] = message_sudo.subtype_id.internal if message_sudo.subtype_id else False
