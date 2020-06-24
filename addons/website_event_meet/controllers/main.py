# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
from werkzeug.exceptions import Forbidden
from werkzeug.utils import redirect

from odoo import http
from odoo.http import request
from odoo.addons.http_routing.models.ir_http import slug


_logger = logging.getLogger(__name__)


class WebsiteEventMeetController(http.Controller):
    @http.route(
        ["/event/<model('event.event'):event>/meeting_rooms"],
        type="http",
        auth="public",
        website=True,
        sitemap=True,
    )
    def event_meeting_rooms(self, event, lang=None, open_room=None):
        if not event.can_access_from_current_website():
            raise Forbidden()

        meeting_rooms = event.sudo().meeting_room_ids

        if lang is not None:
            lang = request.env["res.lang"].browse(int(lang))
            meeting_rooms = meeting_rooms.filtered(lambda m: m.lang_id == lang)

        values = {
            "event": event.sudo(),
            "meeting_rooms": meeting_rooms,
            "current_lang": lang,
            "available_languages": event.sudo().meeting_room_ids.mapped("lang_id"),
            "open_room": int(open_room) if open_room else None,
            "is_event_manager": request.env.user.has_group("event.group_event_manager"),
            "default_lang_code": request.env.user.lang,
        }

        return request.render("website_event_meet.template_meeting_rooms", values)

    @http.route(["/event/create_meeting_room"], type="http", auth="public", methods=["POST"])
    def create_meeting_room(self):
        name = http.request.params.get("name")
        summary = http.request.params.get("summary")
        target_audience = http.request.params.get("audience")
        lang = http.request.params.get("lang")
        max_capacity = http.request.params.get("capacity")
        event_id = int(http.request.params.get("event"))

        # get the record to be sure they really exist
        event = request.env["event.event"].browse(event_id).exists()
        lang = request.env["res.lang"].search([("code", "=", lang)], limit=1)

        if not event or not event.website_published or not lang:
            raise Forbidden()

        _logger.info("New meeting room (%s) create by %s" % (name, request.httprequest.remote_addr))

        meeting_room = request.env["event.meeting_room"].sudo().create(
            {
                "name": name,
                "summary": summary,
                "target_audience": target_audience,
                "max_capacity": max_capacity,
                "lang_id": lang.id,
                "is_pinned": False,
                "event_id": event.id,
            },
        )

        return redirect("/event/%s/meeting_rooms?open_room=%i" % (slug(event), meeting_room.id))

    @http.route(["/event/update_participant_count"], type="json", auth="public")
    def update_participant_count(self, meeting_room_id, joined, participant_count):
        """Update the number of participant in the room.

        Use the SQL keywords "FOR UPDATE SKIP LOCKED" in order to do anything if the SQL
        row is locked (instead of raising an exception, wait for a moment and retry).
        As this endpoint can be called multiple times, and we do not care to have a small
        error in the participant count (but we care about performance).
        """
        meeting_room = request.env["event.meeting_room"].browse(meeting_room_id).exists()
        if not meeting_room or not meeting_room.sudo().event_id.website_published:
            raise Forbidden()

        request.env.cr.execute(
            """
            WITH req AS (
                SELECT id
                  FROM event_meeting_room
                 WHERE id = %s
                   FOR UPDATE SKIP LOCKED
            )
            UPDATE event_meeting_room AS mr
               SET participant_count = %s,
                   last_joined = CASE WHEN %s THEN NOW() ELSE last_joined END,
                   last_activity = NOW(),
                   max_participant_reached = GREATEST(max_participant_reached, %s)
              FROM req
             WHERE mr.id = req.id;
            """,
            [meeting_room_id, participant_count, joined, participant_count]
        )

    @http.route(["/event/active_langs"], type="json", auth="public")
    def active_langs(self):
        return request.env["res.lang"].sudo().search_read([], ["name", "code"])

    @http.route(["/event/<int:meeting_room_id>/is_meeting_room_full"], type="json", auth="public")
    def is_meeting_room_full(self, meeting_room_id):
        """Return True is the given meeting room is full."""
        meeting_room = request.env["event.meeting_room"].browse(meeting_room_id).exists()
        if not meeting_room or not meeting_room.sudo().event_id.website_published:
            raise Forbidden()

        return meeting_room.sudo().is_full
