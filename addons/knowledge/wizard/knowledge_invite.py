# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class KnowledgeInvite(models.TransientModel):
    _name = 'knowledge.invite'
    _description = 'Knowledge Invite Wizard'

    article_id = fields.Many2one('knowledge.article', required=True, ondelete="cascade")
    have_share_partners = fields.Boolean(compute='_compute_have_share_partners')
    partner_ids = fields.Many2many('res.partner', string='Recipients', required=True)
    permission = fields.Selection([
        ('write', 'Can write'),
        ('read', 'Can read'),
        ('none', 'No access')
    ], required=True, default='write')

    def action_invite_members(self):
        category = self.article_id.category
        self.article_id.invite_members(self.partner_ids, self.permission)
        # To pass some data to the client, we can return a new `ir.actions.act_window_close`
        # action and specify an `infos` entry. We will then be able to read those
        # values from the `on_close` callback of the action opening the wizard.
        return {
            'type': 'ir.actions.act_window_close',
            'infos': {
                'reload_tree': category != self.article_id.category
            }
        }

    @api.depends('partner_ids')
    def _compute_have_share_partners(self):
        for wizard in self:
            wizard.have_share_partners = any(partner_id.partner_share for partner_id in self.partner_ids)
