# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api
from odoo.exceptions import UserError

class MailActivityType(models.Model):
    _inherit = "mail.activity.type"

    category = fields.Selection(selection_add=[('reminder', 'Reminder')])

    @api.ondelete(at_uninstall=False)
    def _unlink_except_reminder(self):
        if self.env.ref('project_todo.mail_activity_data_reminder') in self:
            raise UserError("You can not delete Reminder type activity.")

    def action_archive(self):
        if self.env.ref('project_todo.mail_activity_data_reminder') in self:
            raise UserError("You can not archive Reminder type activity.")
        return super().action_archive()
