# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import uuid
from werkzeug.urls import url_join

from odoo import api, fields, models
from odoo.addons.http_routing.models.ir_http import slug


class WebsiteEventMeetingRoom(models.Model):
    _name = "event.meeting_room"
    _description = "Event Meeting Room"
    _order = "is_pinned DESC, last_joined DESC, id"

    name = fields.Char("Topic", required=True, size=50)
    active = fields.Boolean(default=True)
    summary = fields.Char("Summary", size=200)
    target_audience = fields.Char("Audience", required=True, size=30)
    max_capacity = fields.Selection(
        [("4", "4"), ("8", "8"), ("12", "12"), ("16", "16"), ("20", "20")],
        "Max capacity",
        default="8",
        required=True,
    )
    lang_id = fields.Many2one("res.lang", "Language")
    is_pinned = fields.Boolean("Is pinned")
    event_id = fields.Many2one("event.event", "Event", required=True)
    participant_count = fields.Integer("Participant count", default=0, copy=False)
    jitsi_code = fields.Char(
        "Room code",
        required=True,
        copy=False,
        default=lambda self: "odoo-room-%s" % str(uuid.uuid4()),
    )
    is_full = fields.Boolean("Full", compute="_compute_full")

    # reporting fields
    last_joined = fields.Datetime("Last joined", readonly=True, default=fields.Datetime.now(), copy=False)
    last_activity = fields.Datetime("Last activity", readonly=True, default=fields.Datetime.now(), copy=False)
    max_participant_reached = fields.Integer(
        "Max participant reached", readonly=True, copy=False,
        help="Maximum number of participant reached in the room at the same time",
    )

    @api.depends("max_capacity", "participant_count")
    def _compute_full(self):
        for room in self:
            room.is_full = room.participant_count >= int(room.max_capacity)

    def action_join(self):
        """Join the meeting room on the frontend side."""
        web_base_url = self.env["ir.config_parameter"].sudo().get_param("web.base.url")
        url = url_join(web_base_url, f"/event/{slug(self.event_id)}/meeting_rooms?open_room={self.id}")
        return {
            "type": "ir.actions.act_url",
            "url": url,
        }
