# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import http
from odoo.http import request
from odoo.addons.website_profile.controllers.main import WebsiteProfile


class WebsiteSlidesForum(WebsiteProfile):
    # Profile
    # ---------------------------------------------------
    def _prepare_user_profile_parameters(self, **post):
        post = super(WebsiteSlidesForum, self)._prepare_user_profile_parameters(**post)
        if 'channel_id' in post:
            channel = request.env['slide.channel'].browse(int(post.get('channel_id')))
            if channel.forum_id:
                post.update({
                    'forum_id': channel.forum_id.id,
                    'no_forum': False
                })
        return post
