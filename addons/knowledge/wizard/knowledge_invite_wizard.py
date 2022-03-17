# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class KnowledgeInviteWizard(models.TransientModel):
    _name = 'knowledge.invite.wizard'
    _description = 'Knowledge invite wizard'

    # Fields:

    article_id = fields.Many2one('knowledge.article')
    recipients = fields.Many2many('res.partner', string='Recipients')
    permission = fields.Selection([
        ('none', 'None'),
        ('read', 'Read'),
        ('write', 'Read & Write'),
    ], required=True, default='read')

    # Actions:

    def action_invite_members(self):
        self.ensure_one()
        self._action_invite_members()
        return {'type': 'ir.actions.act_window_close'}

    def _action_invite_members(self):
        # TODO: Optimize me
        for recipient in self.recipients:
            self.article_id.invite_member(
                self.permission,
                recipient.id
            )
