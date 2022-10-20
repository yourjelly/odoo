# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class Attachment(models.Model):

    _inherit = "ir.attachment"

    def _can_bypass_serving_attachments_check(self):
        self.ensure_one()
        forbidden = self.url and self.type == 'binary'
        if forbidden and self.url.startswith('/unsplash/'):
            return True
        return super()._can_bypass_serving_attachments_check()
