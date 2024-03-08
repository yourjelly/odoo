# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
import warnings

from odoo import http
from odoo.api import call_kw
from odoo.http import request
from odoo.models import check_method_name
from .utils import clean_action


_logger = logging.getLogger(__name__)


def _call_kw_readonly(registry, request):
    params = request.get_json_data()['params']
    model_class = registry[params['model']]
    method_name = params['method']
    for cls in model_class.mro():
        method = getattr(cls, method_name, None)
        if method is not None and hasattr(method, '_readonly'):
            return method._readonly
    return False

class DataSet(http.Controller):

    def _call_kw(self, model, method, args, kwargs):
        check_method_name(method)
        return call_kw(request.env[model], method, args, kwargs)

    @http.route(['/web/dataset/call_kw', '/web/dataset/call_kw/<path:path>'], type='json', auth="user", readonly=_call_kw_readonly)
    def call_kw(self, model, method, args, kwargs, path=None):
        return self._call_kw(model, method, args, kwargs)

    @http.route(['/web/dataset/call_button', '/web/dataset/call_button/<path:path>'], type='json', auth="user", readonly=_call_kw_readonly)
    def call_button(self, model, method, args, kwargs, path=None):
        action = self._call_kw(model, method, args, kwargs)
        if isinstance(action, dict) and action.get('type') != '':
            return clean_action(action, env=request.env)
        return False

    @http.route('/web/dataset/resequence', type='json', auth="user")
    def resequence(self, model, ids, field='sequence', offset=0, context=None):
        """ Re-sequences a number of records in the model, by their ids

        The re-sequencing starts at the first model of ``ids``, the sequence
        number is incremented by one after each record and starts at ``offset``

        :param ids: identifiers of the records to resequence, in the new sequence order
        :type ids: list(id)
        :param str field: field used for sequence specification, defaults to
                          "sequence"
        :param int offset: sequence number for first record in ``ids``, allows
                           starting the resequencing from an arbitrary number,
                           defaults to ``0``
        """
        if context:
            request.update_context(**context)
        m = request.env[model]
        return m.browse(ids).web_resequence(field, offset, {
            field: {},
        })
