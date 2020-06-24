# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.addons.http_routing.models.ir_http import slug


class Event(models.Model):
    _inherit = "event.event"

    meeting_room_ids = fields.One2many(
        "event.meeting_room", "event_id", string="Meeting rooms"
    )
    meeting_room_count = fields.Integer(
        "Room count", compute="_compute_meeting_room_count"
    )
    website_community = fields.Boolean(
        "Website Community",
        help="Display community tab on website",
        compute="_compute_website_community",
        readonly=False,
        store=True,
    )
    meeting_room_menu_ids = fields.One2many(
        "website.event.menu",
        "event_id",
        string="Event Community Menus",
        domain=[("menu_type", "=", "meeting_room")],
    )

    @api.depends('event_type_id', 'website_community')
    def _compute_website_community(self):
        for event in self:
            if event.event_type_id and event.event_type_id != event._origin.event_type_id:
                event.website_community = event.event_type_id.website_community
            elif not event.website_community:
                event.website_community = False

    @api.depends("meeting_room_ids")
    def _compute_meeting_room_count(self):
        for event in self:
            event.meeting_room_count = len(event.meeting_room_ids or [])

    def _update_website_menus(self):
        super(Event, self)._update_website_menus()

        for event in self:
            if event.website_community and not event.meeting_room_menu_ids:
                # add the community menu
                menu = super(Event, event)._create_menu(
                    sequence=1,
                    name=_("Community"),
                    url="/event/%s/meeting_rooms" % slug(self),
                    xml_id=False,
                )
                event.env["website.event.menu"].create(
                    {
                        "menu_id": menu.id,
                        "event_id": event.id,
                        "menu_type": "meeting_room",
                    }
                )
            elif not event.website_community:
                # remove the community menu
                event.meeting_room_menu_ids.mapped("menu_id").unlink()

    def write(self, vals):
        community_event = self.filtered(lambda e: e.website_community)
        no_community_event = self.filtered(lambda e: not e.website_community)

        super(Event, self).write(vals)

        update_events = community_event.filtered(lambda e: not e.website_community)
        update_events |= no_community_event.filtered(lambda e: e.website_community)
        update_events._update_website_menus()
