# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import babel
import babel.dates
import collections
import datetime
import pytz
import base64
from werkzeug.exceptions import NotFound

from odoo import fields, http
from odoo.http import request
from odoo.tools import plaintext2html, html2plaintext, is_html_empty


class WebsiteEventTrackController(http.Controller):

    @http.route(['''/event/<model("event.event"):event>/track/<model("event.track", "[('event_id','=',event.id)]"):track>'''], type='http', auth="public", website=True, sitemap=True)
    def event_track_view(self, event, track, **post):
        if not event.can_access_from_current_website():
            raise NotFound()

        track = track.sudo().with_context(tz=event.date_tz or 'UTC')
        values = {'track': track, 'event': track.event_id, 'main_object': track}
        return request.render("website_event_track.track_view", values)

    @http.route(['''/event/<model("event.event"):event>/track/<model("event.track", "[('event_id','=',event.id)]"):track>/live_tracks'''], type='json', auth="public", website=True)
    def event_track_live_tracks(self, event, track):
        """ Simple redirect to a search_read since you can't rpc search_read when public user. """
        live_tracks = request.env['event.track'].search([
            ('event_id', '=', event.id),
            ('website_published', '=', True),
            ('youtube_event_url', '!=', False),
            ('is_live', '=', True),
            ('id', '!=', track.id),
        ])

        return {
            'tracks': live_tracks.read(['name', 'partner_id', 'is_live', 'website_url']),
            'viewers': live_tracks.get_viewers_count()
        }

    @http.route(['''/event/<model("event.event"):event>/track/<model("event.track", "[('event_id','=',event.id)]"):track>/upcoming_tracks'''], type='json', auth="public", website=True)
    def event_track_upcoming_tracks(self, event, track):
        """ Simple redirect to a search_read since you can't rpc search_read when public user. """
        upcoming_tracks = request.env['event.track'].search([
            ('event_id', '=', event.id),
            ('website_published', '=', True),
            ('youtube_event_url', '!=', False),
            ('date', '>', fields.Datetime.now()),
            ('id', '!=', track.id),
        ])

        return {
            'tracks': upcoming_tracks.read(['name', 'partner_id', 'is_live', 'website_url']),
            'viewers': upcoming_tracks.get_viewers_count()
        }

    def _get_locale_time(self, dt_time, lang_code):
        """ Get locale time from datetime object

            :param dt_time: datetime object
            :param lang_code: language code (eg. en_US)
        """
        locale = babel.Locale.parse(lang_code)
        return babel.dates.format_time(dt_time, format='short', locale=locale)

    def _prepare_calendar(self, event, event_track_ids):
        local_tz = pytz.timezone(event.date_tz or 'UTC')
        lang_code = request.env.context.get('lang')
        locations = {}                  # { location: [track, start_date, end_date, rowspan]}
        dates = []                      # [ (date, {}) ]
        for track in event_track_ids:
            locations.setdefault(track.location_id or False, [])

        forcetr = True
        for track in event_track_ids:
            start_date = fields.Datetime.from_string(track.date).replace(tzinfo=pytz.utc).astimezone(local_tz)
            end_date = start_date + datetime.timedelta(hours=(track.duration or 0.5))
            location = track.location_id or False
            locations.setdefault(location, [])

            # New TR, align all events
            if forcetr or (start_date>dates[-1][0]) or not location:
                formatted_time = self._get_locale_time(start_date, lang_code)
                dates.append((start_date, {}, bool(location), formatted_time))
                for loc in list(locations):
                    if locations[loc] and (locations[loc][-1][2] > start_date):
                        locations[loc][-1][3] += 1
                    elif not locations[loc] or locations[loc][-1][2] <= start_date:
                        locations[loc].append([False, locations[loc] and locations[loc][-1][2] or dates[0][0], start_date, 1])
                        dates[-1][1][loc] = locations[loc][-1]
                forcetr = not bool(location)

            # Add event
            if locations[location] and locations[location][-1][1] > start_date:
                locations[location][-1][3] -= 1
            locations[location].append([track, start_date, end_date, 1])
            dates[-1][1][location] = locations[location][-1]
            locations = collections.OrderedDict(sorted(locations.items(), key=lambda t: t[0].id if t[0] else 0))
        return {
            'locations': locations,
            'dates': dates
        }

    @http.route(['''/event/<model("event.event"):event>/agenda'''], type='http', auth="public", website=True, sitemap=False)
    def event_agenda(self, event, tag=None, **post):
        if not event.can_access_from_current_website():
            raise NotFound()

        event = event.with_context(tz=event.date_tz or 'UTC')
        local_tz = pytz.timezone(event.date_tz or 'UTC')
        days_tracks = collections.defaultdict(lambda: [])
        for track in event.track_ids.sorted(lambda track: (bool(track.date), track.date, bool(track.location_id))):
            if not track.date:
                continue
            date = fields.Datetime.from_string(track.date).replace(tzinfo=pytz.utc).astimezone(local_tz)
            days_tracks[str(date)[:10]].append(track)

        days = {}
        tracks_by_days = {}
        for day, tracks in days_tracks.items():
            tracks_by_days[day] = tracks
            days[day] = self._prepare_calendar(event, tracks)

        return request.render("website_event_track.agenda", {
            'event': event,
            'main_object': event,
            'days': days,
            'tracks_by_days': tracks_by_days,
            'tag': tag
        })

    @http.route([
        '''/event/<model("event.event"):event>/track''',
        '''/event/<model("event.event"):event>/track/tag/<model("event.track.tag"):tag>'''
    ], type='http', auth="public", website=True, sitemap=False)
    def event_tracks(self, event, tag=None, **post):
        if not event.can_access_from_current_website() or (tag and tag.color == 0):
            raise NotFound()

        event = event.with_context(tz=event.date_tz or 'UTC')
        searches = {}
        if tag:
            searches.update(tag=tag.id)
            tracks = event.track_ids.filtered(lambda track: tag in track.tag_ids)
        else:
            tracks = event.track_ids

        values = {
            'event': event,
            'main_object': event,
            'tracks': tracks,
            'tags': event.tracks_tag_ids,
            'searches': searches,
            'html2plaintext': html2plaintext
        }
        return request.render("website_event_track.tracks", values)

    @http.route(['''/event/<model("event.event"):event>/track_proposal'''], type='http', auth="public", website=True, sitemap=False)
    def event_track_proposal(self, event, **post):
        if not event.can_access_from_current_website():
            raise NotFound()

        return request.render("website_event_track.event_track_proposal", {'event': event, 'main_object': event})

    @http.route(['''/event/<model("event.event"):event>/track_proposal/post'''], type='http', auth="public", methods=['POST'], website=True)
    def event_track_proposal_post(self, event, **post):
        if not event.can_access_from_current_website():
            raise NotFound()

        tags = []
        for tag in event.allowed_track_tag_ids:
            if post.get('tag_' + str(tag.id)):
                tags.append(tag.id)

        track = request.env['event.track'].sudo().create({
            'name': post['track_name'],
            'partner_name': post['partner_name'],
            'partner_email': post['email_from'],
            'partner_phone': post['phone'],
            'partner_biography': plaintext2html(post['biography']),
            'event_id': event.id,
            'tag_ids': [(6, 0, tags)],
            'user_id': False,
            'description': plaintext2html(post['description']),
            'image': base64.b64encode(post['image'].read()) if post.get('image') else False
        })
        if request.env.user != request.website.user_id:
            track.sudo().message_subscribe(partner_ids=request.env.user.partner_id.ids)
        else:
            partner = request.env['res.partner'].sudo().search([('email', '=', post['email_from'])])
            if partner:
                track.sudo().message_subscribe(partner_ids=partner.ids)
        return request.render("website_event_track.event_track_proposal", {'track': track, 'event': event})

    @http.route('/event/<model("event.event"):event>/exhibitor', type='http', auth="public", website=True, sitemap=False)
    def event_exhibitors(self, event, **post):
        if not event.can_access_from_current_website():
            raise NotFound()

        values = {
            'event': event,
            'main_object': event,
            'user_name': request.env.user.name if not request.env.user._is_public() else None,
            'user_email': request.env.user.email_formatted if not request.env.user._is_public() else None,
        }
        return request.render("website_event_track.exhibitors", values)

    @http.route('/event/<model("event.event"):event>/lobby', type='http', auth="public", website=True, sitemap=False)
    def event_lobby(self, event):
        if not event.can_access_from_current_website():
            raise NotFound()

        STARTING_SOON_HOURS_DELTA = 3
        event = event._set_tz_context()
        values = {
            'event': event,
            'upcoming_tracks': event.track_ids.filtered(lambda track:
                track.date > fields.Datetime.now() and
                track.date < fields.Datetime.now() + datetime.timedelta(hours=STARTING_SOON_HOURS_DELTA)),
            'main_object': event,
            'html2plaintext': html2plaintext,
            'is_html_empty': is_html_empty
        }
        return request.render("website_event_track.lobby", values)
