# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import json

from odoo import http
from odoo.http import content_disposition, request
from odoo.addons.web.controllers.main import _serialize_exception
from odoo.tools import html_escape


class BomReportController(http.Controller):

    @http.route('/bom_report', type='http', auth='user', methods=['POST'], csrf=False)
    def get_report(self, model, options, output_format, token, **kw):
        uid = request.session.uid
        report_obj = request.env[model].sudo(uid)
        options = json.loads(options)
        report_name = "bom_structure_sheet"
        try:
            if output_format == 'xlsx':
                response = request.make_response(
                    None,
                    headers=[
                        ('Content-Type', 'application/vnd.ms-excel'),
                        ('Content-Disposition', content_disposition(report_name + '.xlsx'))
                    ]
                )
                report_obj.get_xlsx(options, response)

            response.set_cookie('fileToken', token)
            return response

        except Exception as e:
            se = _serialize_exception(e)
            error = {
                'code': 200,
                'message': 'Odoo Server Error',
                'data': se
            }
            return request.make_response(html_escape(json.dumps(error)))
