# -*- coding: utf-8 -*-
import logging
import pprint
import werkzeug

from openerp import http
from openerp.http import request

_logger = logging.getLogger(__name__)


class MoneticoController(http.Controller):
    _accept_url = '/payment/monetico/accept'
    _exception_url = '/payment/monetico/exception'

    @http.route([
        '/payment/monetico/accept/',
        '/payment/monetico/exception/',
    ], type='http', auth='public', csrf=False)
    def monetico_form_feedback(self, **post):
        _logger.info('Monetico: entering form_feedback with post data %s', pprint.pformat(post))

        # verify mac
        keys = "TPE date montant reference texte_libre version code-retour cvx vld brand status3ds numauto motifrefus originecb bincb hpancb ipclient originetr veres pares"
        post["version"] = "3.0"
        mac = post.get('MAC') or None
        mac_check = request.env['payment.acquirer'].search([('provider', '=', 'monetico')]).sudo()._monetico_generate_mac(keys, post)

        if post.has_key("MAC") and mac_check.upper() == mac.upper():
            sResult = "0\n"
            # process
            request.env['payment.transaction'].sudo().form_feedback(post, 'monetico')
        else:
            sResult = "1\n"
            error_msg = ('Monetico: invalid mac, received %s, computed %s') % (mac, mac_check)
            _logger.info(error_msg)

        # Monetico is expecting a response to the POST sent by their server.
        return request.make_response('version=2\ncdr=' + sResult, [('Pragma', 'no-cache'),('Content-type', 'text/plain')])
