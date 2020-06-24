# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import uuid

from odoo import api, fields, models


class WebsiteEventMeetingRoom(models.Model):
    _name = "event.meeting_room"
    _description = "Event Meeting Room"
    _order = "pinned DESC, last_joined DESC, id"

    name = fields.Char("Topic", required=True)
    active = fields.Boolean(default=True)
    summary = fields.Char("Summary")
    target_audience = fields.Char("Audience", required=True)
    max_capacity = fields.Selection(
        [("4", "4"), ("8", "8"), ("12", "12"), ("16", "16"), ("20", "20")],
        "Max capacity",
        default="8",
        required=True,
    )
    lang_id = fields.Many2one("res.lang", "Language")
    last_joined = fields.Datetime(
        "Last joined datetime", readonly=True, default=fields.Datetime.now()
    )
    pinned = fields.Boolean("Is pinned", groups="base.group_system")
    event_id = fields.Many2one("event.event", "Event", required=True)
    participant_count = fields.Integer("Participant count", default=0, copy=False)
    jitsi_code = fields.Char(
        "Room code",
        required=True,
        copy=False,
        default=lambda x: "odoo-room-%s" % str(uuid.uuid4()),
    )
    full = fields.Boolean("Full", compute="_compute_full")

    @api.depends("max_capacity", "participant_count")
    def _compute_full(self):
        for room in self:
            room.full = room.participant_count >= int(room.max_capacity)
