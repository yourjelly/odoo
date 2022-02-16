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
        pass
