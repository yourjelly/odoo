from odoo import http
import requests
from logging import getLogger
from odoo.http import request
import json

_logger = getLogger(__name__)

class BatchQueryDispatcher(http.Controller):

    @http.route('/wowl/batch-query-dispatch', type='json', auth='none', methods=['POST'])
    def dispatch(self, **kw):

        request.uid = request.session.uid

        rpcs = kw['rpcs']
        for rpc in rpcs:

            route = rpc['rpc']['route']
            if route.startswith('/'):
                route = route[1:]

            data = {}
            if "params" in rpc['rpc']:
                data = rpc['rpc']['params']

            result = requests.post('http://localhost:8069/' + route, data=data)
            _logger.info(result)
        _logger.info(self)
