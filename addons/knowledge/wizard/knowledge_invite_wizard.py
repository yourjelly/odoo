# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class KnowledgeInviteWizard(models.TransientModel):
    _name = 'knowledge.invite.wizard'
    _description = 'Knowledge invite wizard'

    article_id = fields.Many2one('knowledge.article')
    recipients = fields.Many2many('res.users', string='Recipients')

    # Actions

    def action_invite_users(self):
        self.ensure_one()
        self._action_invite_users()
        return {'type': 'ir.actions.act_window_close'}

    def _action_invite_users(self):
        # TODO: Invite users
        print('Inviting users...')
        email_values = {}
        template = self.env.ref('knowledge.mail_template_user_invite')
        if template:
            template.send_mail(
                self.env.user.id,
                email_layout_xmlid='mail.mail_notification_light',
                email_values=email_values
            )
