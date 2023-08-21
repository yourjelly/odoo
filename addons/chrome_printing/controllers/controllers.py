# -*- coding: utf-8 -*-
from odoo import http
from odoo.http import request


from odoo.addons.web.controllers.report import ReportController



class ReportController(ReportController):

    @http.route([
        '/report/<converter>/<reportname>',
        '/report/<converter>/<reportname>/<docids>',
    ], type='http', auth='user', website=True)
    def report_routes(self, reportname, docids=None, converter=None, **data):
        return super().report_routes(reportname, docids=docids, converter=converter, **data)
