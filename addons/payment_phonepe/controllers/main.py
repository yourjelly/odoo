# Part of Odoo. See LICENSE file for full copyright and licensing details.

import hmac
import logging
import pprint

from werkzeug.exceptions import Forbidden

from odoo import http
from odoo.http import request


_logger = logging.getLogger(__name__)


class PhonePeController(http.Controller):
    _return_url = '/payment/phonepe/return/'
    _callback_url = '/payment/phonepe/callback/'

    # @http.route(_return_url, method=['POST'], type='http', auth='public', csrf=False)
    # def phonepe_return(self, **data):
    #     _logger.info('PhonePe: Entering form_feedback with post data %s', pprint.pformat(data))
    #     if data:
    #         tx_sudo = request.env['payment.transaction'].sudo()._get_tx_from_notification_data('phonepe', data)
    #         print(tx_sudo)
    #         # self._verify_notification_signature(data, data.get('checksum'), tx_sudo)
    #         tx_sudo._handle_notification_data('phonepe', data)
    #     return request.redirect('/payment/status')
    
    @http.route(_callback_url, method=['POST', 'GET'], type='http', auth='public', csrf=False)
    def phonepe_callback(self, **data):

        _logger.info('PhonePe: Entering form_feedback with post data %s', pprint.pformat(data))
        if data.get('response'):
            response = data.get('response')
            pt_sudo = request.env['payment.transaction'].sudo()
            decode_response = pt_sudo._phonepe_decode_payload(response)
            tx_sudo = pt_sudo._get_tx_from_notification_data('phonepe', decode_response.get('data'))
            header = request.httprequest.headers.get('X-VERIFY') or data.headers.get('X-VERIFY')
            self._verify_notification_signature(response, header, tx_sudo)
            tx_sudo._handle_notification_data('phonepe', decode_response)
        return request.redirect('/payment/status')

    @staticmethod
    def _verify_notification_signature(notification_data, received_signature, tx_sudo, is_response=True):
        #security level needs to be added by passing encryption in params
        if not received_signature:
            _logger.warning("Received notification with missing signature.")
            raise Forbidden()

        expected_signature = tx_sudo._phonepe_prepare_checksum(notification_data, is_response=is_response)
        if not hmac.compare_digest(received_signature, expected_signature):
            _logger.warning("Received notification with invalid signature.")
            raise Forbidden()
