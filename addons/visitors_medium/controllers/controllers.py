# -*- coding: utf-8 -*-
from datetime import timedelta, date
from odoo import http, fields
from odoo.http import request


class VisitorsMedium(http.Controller):

    @http.route('/visitors_medium/search', auth='user', type='json')
    def graph_search(self, inputvalue):
        today = fields.datetime.now()
        if inputvalue == "LastWeek":
            weekday = today.weekday()
            start_date = today - timedelta(days=weekday, weeks=1)
            end_date = start_date + timedelta(days=6)

        elif inputvalue == "LastMonth":
            end_date = today - timedelta(today.day)
            start_date = end_date.replace(day=1)

        elif inputvalue == "LastYear":
            start_date = date(today.year-1, 1, 1)
            end_date = date(today.year-1, 12, 31)
        serveys = request.env['visitors_medium.graph'].search([('date', '>=', start_date), ('date', '<', end_date)])
        dictlist = []

        for rec in serveys:
            value = request.env['visitors_medium.graph'].search_count([('target_id.id', '=', rec.target_id.id), ('source_id.id', '=', rec.source_id.id)])
            dictlist.append({'source': rec.source_id.name, 'target': rec.target_id.name, 'value': value})
        return dictlist
