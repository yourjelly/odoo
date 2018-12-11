# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models, fields


class IrAttachment(models.Model):

    _inherit = "ir.attachment"

    local_url = fields.Char("Attachment URL", compute='_compute_local_url')

    def _compute_local_url(self):
        self.ensure_one()
        if self.url:
            self.local_url = self.url
        else:
            self.local_url = '/web/image/%s?unique=%s' % (self.id, self.checksum)
