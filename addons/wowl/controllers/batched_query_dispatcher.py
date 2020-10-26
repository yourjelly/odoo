from odoo import http
import requests
from logging import getLogger
from odoo.http import request
import json
import time

class BatchQueryDispatcher(http.Controller):

    @http.route('/wowl/batch-query-dispatch', type='json', auth='none', methods=['POST'])
    def dispatch(self, **kw):

        start = time.monotonic()

        all_rpc_results = []
        all_rpc_status = []

        request.csrf_token()
        cookies = {'session_id': request.session.sid}

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

            responseData = None

            if result.ok:
                responseData = json.loads(result.text)['result']
            else:
                responseData = json.loads(result.text)['error']

            all_rpc_results.append(responseData)
            all_rpc_status.append(result.status_code)

        end = time.monotonic()
        return { 'server_time': end-start, 'status': all_rpc_status, 'responses': all_rpc_results }
