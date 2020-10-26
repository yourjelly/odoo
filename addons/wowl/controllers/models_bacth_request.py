import functools

from odoo import http
from odoo.http import request
from logging import getLogger
from odoo.api import call_kw
from odoo.models import check_method_name

_logger = getLogger(__name__)

def batch(func):
    @functools.wraps(func)
    def route_method(*args, **kwargs):
        all_results = []
        rpcs = kwargs['rpcs']

        _logger.info('Handle batch of %i rpcs' % len(rpcs))

        for rpc in rpcs:
            result = func(rpc)
            response = {
                'data': result,
                'id': rpc['id']
            }
            all_results.append(response)
        return all_results

class ModelsBatchRequest(http.Controller):
    """
    @http.route('/wowl/batch-models-2', type='json', auth="user")
    @batch
    def handle2(self, rpc):
        check_method_name(rpc['rpc']['params']['method'])
        result = call_kw(
            request.env[rpc['rpc']['params']['model']],
            rpc['rpc']['params']['method'],
            rpc['rpc']['params']['args'],
            rpc['rpc']['params']['kwargs']
        )
        return result
    """

    @http.route('/wowl/batch-models', type='json', auth="user")
    def handle(self, **kw):

        all_results = []
        rpcs = kw['rpcs']

        for rpc in rpcs:
            check_method_name(rpc['rpc']['params']['method'])
            result = call_kw(request.env[rpc['rpc']['params']['model']], rpc['rpc']['params']['method'], rpc['rpc']['params']['args'], rpc['rpc']['params']['kwargs'])

            response = {
                'data': result,
                'id': rpc['id']
            }

            all_results.append(response)

        return all_results
