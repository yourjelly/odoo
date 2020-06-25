# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class Track(models.Model):
    _name = "event.track.partner"
    _description = "Decorated Many2Many between event.track and res.partner to keep wishlisted track and points gained " \
                   "on eventual quiz on tracks."
    _table = 'event_track_partner'

    partner_id = fields.Many2one('res.partner', required=True, string='Partner')
    track_id = fields.Many2one('event.track', required=True, string='Track')
    is_wishlisted = fields.Boolean(string="Is Wishlisted")
    quiz_points = fields.Integer(string="Quiz Points", help="Points earned on the track's quiz")
