# Part of Odoo. See LICENSE file for full copyright and licensing details.

import json
from odoo import http
from odoo.http import request


class EwaybillController(http.Controller):

    @http.route('/l10n_in_ewaybill/ewaybill_json/<int:id>', type='http', auth='user')
    def ewaybill_json(self, ewaybill_id, **args):
        ewaybill = request.env['l10n.in.ewaybill'].browse(ewaybill_id)
        json_data = json.dumps(ewaybill._l10n_in_ewaybill_generate_json(ewaybill), indent=4)

        headers = [
            ('Content-Type', 'text/plain'),
            ('Content-Disposition', 'attachment; filename=' + 'ewaybill_content' + '.txt;')
        ]

        return request.make_response(json_data, headers)
