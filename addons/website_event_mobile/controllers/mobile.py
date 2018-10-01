# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import http
from odoo.http import request


class WebsiteEventMobileController(http.Controller):

    @http.route(['/event/mobile/data'], type='json', auth='public')
    def event_base_data(self, event_id, **args):
        event = request.env['event.event'].sudo().search([('id', '=', event_id), ('website_published', '=', True)])
        if not event:
            return {}
        event_data = {
            'event': event.read(['id', 'name', 'date_begin', 'date_end', 'date_tz', 'website_published', 'write_date', 'create_date'])[0]
        }
        # Tags
        tags = request.env['event.track.tag'].sudo().search([('track_ids.event_id', '=', event_id)])
        event_data.update({'tags': tags.read(['id', 'name', 'color'])})

        # Sponsors
        sponsors = request.env['event.sponsor'].sudo().search([('event_id', '=', event_id)])
        event_data.update({'sponsors': sponsors.read(["id", "url", "sponsor_type_id", "sequence", "partner_id", "image_medium", "write_date", "create_date"])})
        return event_data

    @http.route(['/event/mobile/tracks'], type='json', auth='public')
    def event_tracks(self, event_id, offset=0, limit=0, **args):
        event = request.env['event.event'].sudo().search([('id', '=', event_id), ('website_published', '=', True)])
        if not event:
            return {}
        track_fields = ["id", "user_id", "partner_id", "name", "partner_name", "partner_email", "location_id", "tag_ids", "duration", "date", "write_date", "create_date", "stage_id", "description", "image", "website_url"]
        tracks = []
        domain = [('event_id', '=', event_id)]
        if args.get('write_date'):
            domain += [('write_date', '>', args.get('write_date'))]
        for track in request.env['event.track'].sudo().search(domain, offset=offset, limit=limit):
            track_data = track.read(track_fields)[0]
            track_data['partner_website_description'] = track.partner_id.website_description
            tracks.append(track_data)
        return {
            'records': tracks,
            'length': len(tracks)
        }
