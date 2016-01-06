# -*- coding: utf-8 -*-

from openerp import http, SUPERUSER_ID
from openerp.http import request

class WebsiteForm(http.Controller):
    @http.route('''/website/helpdesk/<model("helpdesk.team", "[('feature_form','=',True]"):team>''', type='http', auth="public", methods=['POST'], website=True)
    def website_helpdesk_form(self, team, **kwargs):
        return request.website.render("helpdesk_website.ticket_submit", {'team': team})
