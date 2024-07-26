# -*- coding: utf-8 -*-

from odoo import models, fields, api
class PartnerTrackDetail(models.Model):
    _name = 'partner.track.detail'
    _description = 'Partner Track Details'
    _rec_name = 'partner_id'

    longitude = fields.Float(required=True)
    latitude = fields.Float(required=True)
    partner_id = fields.Many2one('res.partner')
    channel_id = fields.Many2one('partner.track.channel')
    place = fields.Char()
    time = fields.Char(compute='_compute_time')

    @api.depends('create_date')
    def _compute_time(self):
        for rec in self:
            rec.time = rec.create_date.time().strftime('%H:%M:%S')
