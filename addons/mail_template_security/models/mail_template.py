# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models, _
from odoo.exceptions import AccessError


class MailTemplate(models.Model):
    _inherit = 'mail.template'

    def _check_access(self):
        if not self.env.is_admin() and not self.env.user.has_group('mail_template_security.group_mail_template_editor'):
            raise AccessError(_('Only "Template Editor" can modify an email template.\nContact your administrator.'))

    @api.model
    def create(self, vals):
        self._check_access()
        return super(MailTemplate, self).create(vals)

    def write(self, vals):
        self._check_access()
        return super(MailTemplate, self).write(vals)

    def unlink(self):
        self._check_access()
        return super(MailTemplate, self).unlink()

    def _check_render_template_permission(self, template):
        """Raise an error if we can not render the Jinja code.
        Return False if the template is static (so no need to render it).
        Return True if the template is dynamic (contains Jinja code).
        """
        if (
            template.is_dynamic
            and not self.env.is_admin()
            and not self.env.user.has_group('mail_template_security.group_mail_template_editor')
        ):
            raise AccessError(_(
                'This email template is protected and you are not authorized to use it.\n'
                'Try sending another message or contact your administrator.'
            ))

        return template.is_dynamic
