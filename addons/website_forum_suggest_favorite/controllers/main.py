# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import json
import lxml
import requests
import logging
import werkzeug.exceptions
import werkzeug.urls
import werkzeug.wrappers

from datetime import datetime

from odoo import http, tools, _
from odoo.addons.http_routing.models.ir_http import slug
from odoo.addons.website.models.ir_http import sitemap_qs2dom
from odoo.addons.website_forum.controllers.main import WebsiteForum
from odoo.http import request

class WebsiteForumSuggestFavorite(WebsiteForum):

    @http.route('/forum/<model("forum.forum"):forum>/question/<model("forum.post"):question>/suggest_favorite', type='json', auth="user", methods=['POST'], website=True)
    def question_suggest_favorite(self, forum, question, targetUser, **post):
        #add another user to the favorites of the question (functional need from KGB : suggest a question to someone)
        if not request.session.uid: 
            return {'error': 'anonymous_user'}

        #TODO : check if the user is an employee

        if targetUser not in question.favourite_ids:
            # favourite_ids = [(4, request.uid)]
            question.sudo().write({'favourite_ids': [(4, targetUser.id)]})