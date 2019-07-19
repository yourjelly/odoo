# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
import urllib3
import json

from odoo import http
from odoo.http import request

_logger = logging.getLogger(__name__)


class StarController(http.Controller):

    @http.route('/pos_star_cloud', type='json', auth='public')
    def pos_star_cloud(self):
        _logger.error('hello')
        data = request.jsonrequest
        # import pdb; pdb.set_trace()
        _logger.error(data)
        datare = {
            'jobReady': 'true',
            'uniqueID': 'StarOne',
            'SetID': 'StarTwo',
            "clientAction": [
                {"request":"GetPollInterval","result":"10"},
                {"request":"Encodings","result":"image/png; image/jpeg; application/vnd.star.raster; application/vnd.star.line; application/vnd.star.linematrix; text/plain; application/octet-stream"}
                ]
            }
        resp = request._json_response(json.dumps(datare))
        _logger.error(resp.response)
        return datare


