# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models

class IrAttachment(models.Model):
    _inherit = 'ir.attachment'

    def _attachment_format_iteration(self, attachment, commands, attachments_options):
        res = super(IrAttachment, self)._attachment_format_iteration(attachment, commands, attachments_options)
        if attachments_options.get('access_token'):
            res['access_token'] = attachment.sudo().generate_access_token()[0]
        return res
