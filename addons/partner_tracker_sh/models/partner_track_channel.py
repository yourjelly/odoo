# -*- coding: utf-8 -*-

from odoo import models, fields

class PartnerTrackChannel(models.Model):
    _name = 'partner.track.channel'
    _description = 'Track The Partner'

    name = fields.Char('Name', required=True)
    state = fields.Selection([('start', 'Start'), ('stop', 'Stop')], default='start')
    partner_ids = fields.Many2many('res.partner', required=True)
    user_id = fields.Many2one('res.users', required='True')
    radius = fields.Float(default=10)
    track_detail_ids = fields.One2many('partner.track.detail', 'channel_id')

    def partner_track_detail_action(self):
        self.ensure_one()
        action = self.env.ref('partner_tracker.partner_track_detail_action').read()[0]
        action['domain'] = [('channel_id', '=', self.id)]
        return action
