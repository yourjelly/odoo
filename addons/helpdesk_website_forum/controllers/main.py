# -*- coding: utf-8 -*-

from openerp import http, SUPERUSER_ID
from openerp.http import request

class WebsiteForm(http.Controller):
    @http.route('''/website/helpdesk/<model("helpdesk.team", "[('feature_helpcenter','=',True]"):team>''', type='http', auth="public", website=True)
    def website_helpdesk_form(self, team, **kwargs):
        ctx = {'team': team}
        ctx['forum'] = team.feature_helpcenter_id
        if team.feature_helpcenter_id:
            ctx['questions'] = request.env['forum.post'].search([('forum_id','=',ctx['forum'].id),('parent_id','=',False)], limit=10)
        return request.website.render("helpdesk_website_forum.home", ctx)
