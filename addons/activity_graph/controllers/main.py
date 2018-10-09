# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import http
from odoo.http import request


class WebsiteDepartment(http.Controller):

    @http.route("/author/select", type="json", auth="public", csrf=False)
    def dropdown_select(self):
        author = request.env['mail.activity'].search([]).mapped('user_id.name')
        types = request.env['mail.activity'].search([]).mapped('activity_type_id.name')
        return {'author': author, 'types': types}

    @http.route("/author/search", type="json", auth="public", csrf=False)
    def all_authors(self, selected_value, search_type):
        MailActivity = request.env['mail.activity']
        Authors = MailActivity.search([('user_id.name', '=', selected_value)]) if search_type == 'Author' else MailActivity.search([('activity_type_id.name', '=', selected_value)])
        taskName = MailActivity.search([]).mapped('activity_type_id.name') if search_type == 'Author' else MailActivity.search([]).mapped('user_id.name')

        mylist = [{
                'taskName': rec.activity_type_id.name if search_type == "Author" else rec.user_id.name,
                'startdate': rec.startdate,
                'enddate': rec.date_deadline,
                'status': rec.state
            } for rec in Authors]

        return {"data": mylist, 'taskName': taskName}
