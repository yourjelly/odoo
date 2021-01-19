# -*- coding: utf-8 -*-
from odoo import http
from odoo.http import request


import odoo.addons.web.controllers.main as web


class ReportController(web.ReportController):

    @http.route([
        '/report/<converter>/<reportname>',
        '/report/<converter>/<reportname>/<docids>',
    ], type='http', auth='user', website=True)
    def report_routes(self, reportname, docids=None, converter=None, **data):
        data['_chrome_sid'] = request.session.sid
        return super().report_routes(reportname, docids=docids, converter=converter, **data)
