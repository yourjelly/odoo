# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models, _
from odoo.exceptions import AccessError


class SmsTemplate(models.Model):
    _inherit = 'sms.template'

    def _check_access(self):
        if not self.env.is_admin() and not self.env.user.has_group('mail_template_security.group_mail_template_editor'):
            raise AccessError(_('Only "Template Editor" can modify a SMS template.\nContact your administrator.'))

    @api.model
    def create(self, vals):
        self._check_access()
        return super(SmsTemplate, self).create(vals)

    def write(self, vals):
        self._check_access()
        return super(SmsTemplate, self).write(vals)

    def unlink(self):
        self._check_access()
        return super(SmsTemplate, self).unlink()
