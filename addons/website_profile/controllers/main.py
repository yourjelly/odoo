# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import base64
import werkzeug.exceptions
import werkzeug.urls
import werkzeug.wrappers

from odoo import http
from odoo.http import request
from odoo.osv import expression


class WebsiteProfile(http.Controller):
    # Profile
    # ---------------------------------------------------
    def _check_user_profile_access(self, user_id):
        user_sudo = request.env['res.users'].sudo().browse(user_id)
        if user_sudo.karma == 0 or not user_sudo.website_published or \
            (user_sudo.id != request.session.uid and request.env.user.karma < request.website.karma_profile_min):
            return False
        return user_sudo

    def _prepare_user_values(self, **kwargs):
        values = {
            'user': request.env.user,
            'is_public_user': request.website.is_public_user(),
            'notifications': self._get_badge_granted_messages(),
            'header': kwargs.get('header', dict()),
            'searches': kwargs.get('searches', dict()),
            'validation_email_sent': request.session.get('validation_email_sent', False),
            'validation_email_done': request.session.get('validation_email_done', False),
        }
        values.update(kwargs)
        return values

    def _prepare_user_profile_parameters(self, **post):
        return post

    def _prepare_user_profile_values(self, user, **post):
        return {
            'uid': request.env.user.id,
            'user': user,
            'main_object': user,
            'is_profile_page': True,
            'edit_button_url_param': '',
        }

    @http.route(['/profile/user/<int:user_id>'], type='http', auth="public", website=True)
    def view_user_profile(self, user_id, **post):
        user = self._check_user_profile_access(user_id)
        if not user:
            return request.render("website_profile.private_profile", {}, status=404)
        params = self._prepare_user_profile_parameters(**post)
        values = self._prepare_user_profile_values(user, **params)
        return request.render("website_profile.user_profile_main", values)

    # Edit Profile
    # ---------------------------------------------------
    @http.route('/profile/edit', type='http', auth="user", website=True)
    def view_user_profile_edition(self, **kwargs):
        countries = request.env['res.country'].search([])
        values = self._prepare_user_values(searches=kwargs)
        values.update({
            'email_required': kwargs.get('email_required'),
            'countries': countries,
            'notifications': self._get_badge_granted_messages(),
            'url_param': kwargs.get('url_param'),
        })
        return request.render("website_profile.user_profile_edit_main", values)

    def _profile_edition_preprocess_values(self, user, **kwargs):
        values = {
            'name': kwargs.get('name'),
            'website': kwargs.get('website'),
            'email': kwargs.get('email'),
            'city': kwargs.get('city'),
            'country_id': int(kwargs.get('country')) if kwargs.get('country') else False,
            'website_description': kwargs.get('description'),
        }

        if 'clear_image' in kwargs:
            values['image'] = False
        elif kwargs.get('ufile'):
            image = kwargs.get('ufile').read()
            values['image'] = base64.b64encode(image)

        if request.uid == user.id:  # the controller allows to edit only its own privacy settings; use partner management for other cases
            values['website_published'] = kwargs.get('website_published') == 'True'
        return values

    def _save_edited_profile(self, **kwargs):
        user = request.env.user
        values = self._profile_edition_preprocess_values(user, **kwargs)
        user.write(values)
        return user

    @http.route('/profile/user/save', type='http', auth="user", methods=['POST'], website=True)
    def save_edited_profile(self, **kwargs):
        user = self._save_edited_profile(**kwargs)
        if kwargs.get('url_param'):
            return werkzeug.utils.redirect("/profile/user/%d?%s" % (user.id, kwargs.get('url_param')))
        else:
            return werkzeug.utils.redirect("/profile/user/%d" % user.id)
    # Ranks
    # ---------------------------------------------------
    @http.route('/profile/ranks', type='http', auth="public", website=True)
    def ranks(self, **kwargs):
        Rank = request.env['gamification.karma.rank']
        ranks = Rank.sudo().search([])
        ranks = ranks.sorted(key=lambda b: b.karma_min)
        values = {
            'ranks': ranks,
        }
        return request.render("website_profile.rank_main", values)

    # Badges
    # ---------------------------------------------------
    def _get_badge_granted_messages(self):
        badge_subtype = request.env.ref('gamification.mt_badge_granted', raise_if_not_found=False)
        msg = request.env['mail.message']
        if badge_subtype:
            msg = msg.search([('subtype_id', '=', badge_subtype.id), ('needaction', '=', True)])
        return msg

    def _prepare_badges_domain(self, **kwargs):
        """
        Hook for other modules to restrict the badges showed on profile page, depending of the context
        """
        domain = [('website_published', '=', True)]
        if 'category' in kwargs:
            domain = expression.AND([[('challenge_ids.category', '=', kwargs.get('category'))], domain])
        return domain

    @http.route('/profile/badge', type='http', auth="public", website=True)
    def badges(self, **kwargs):
        Badge = request.env['gamification.badge']
        badges = Badge.sudo().search(self._prepare_badges_domain(**kwargs))
        badges = sorted(badges, key=lambda b: b.stat_count_distinct, reverse=True)
        values = self._prepare_user_values(searches={'badges': True})
        values.update({
            'badges': badges,
        })
        return request.render("website_profile.badge_main", values)
