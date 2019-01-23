# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import http
from odoo.http import request
from odoo.addons.website_profile.controllers.main import WebsiteProfile


class WebsiteSlidesForum(WebsiteProfile):
    # Profile
    # ---------------------------------------------------
    @http.route(['/slides/<model("slide.channel"):channel>/user/<int:user_id>'], type='http', auth="public", website=True)
    def view_user_slides_forum_profile(self, channel, user_id, **post):
        values = self._prepare_user_values(channel=channel, forum=channel.forum_id, **post)

        user = self._check_user_profile_access(user_id)
        if not user:
            return request.render("website_slides.private_profile", values, status=404)
        current_user = request.env.user.sudo()

        values.update(self._prepare_open_forum_user(user, current_user, channel.forum_id, values, **post))
        values.update(self._prepare_user_slides_profile(user))
        return request.render("website_slides_forum.slides_forum_user_profile_main", values)

    @http.route(['/slides/user/<int:user_id>'], type='http', auth="public", website=True)
    def view_user_cross_slides_forum_profile(self, user_id, **post):
        channels = self._get_channels(**post)
        if not channels:
            channels = request.env['slide.channel'].search([])

        if len(channels) == 1:
            forums = channels[0].forum_id
        else:
            forums = channels.mapped('forum_id')

        values = self._prepare_user_values(forum=forums[0] if len(forums) == 1 else False if len(forums) == 0 else True,
                                           channel=channels[0] if len(channels) == 1 else True,
                                           **post)

        user = self._check_user_profile_access(user_id)
        if not user:
            return request.render("website_slides.private_profile", values, status=404)
        current_user = request.env.user.sudo()

        values.update(self._prepare_open_forum_user(user, current_user, forums, values, **post))
        values.update(self._prepare_user_slides_profile(user))
        return request.render("website_slides_forum.cross_slides_forum_user_profile_main", values)
