from odoo import http
import requests
from logging import getLogger
from odoo.http import request
import json

_logger = getLogger(__name__)

class BatchQueryDispatcher(http.Controller):

    @http.route('/wowl/batch-query-dispatch', type='json', auth='none', methods=['POST'])
    def dispatch(self, **kw):

        all_rpc_results = []
        request.csrf_token()
        cookies = {'session_id':request.session.sid }

        rpcs = kw['rpcs']
        for rpc in rpcs:
            route = rpc['rpc']['route']
            if route.startswith('/'):
                route = route[1:]

            data = request.jsonrequest
            data['csrf_token'] = request.csrf_token()
            del data["params"]
            if "params" in rpc['rpc']:
                data["params"] = rpc['rpc']['params']

            result = requests.post('http://localhost:8069/' + route, json=data, cookies=cookies)
            all_rpc_results.append(json.loads(result.text)['result'])
        return all_rpc_results
