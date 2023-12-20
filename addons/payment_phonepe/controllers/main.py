# Part of Odoo. See LICENSE file for full copyright and licensing details.

import hmac
import logging
import pprint

from werkzeug.exceptions import Forbidden

from odoo import http
from odoo.http import request


_logger = logging.getLogger(__name__)


class PhonePeController(http.Controller):
    _callback_url = '/callback-url'
    _return_url = '/redirect-url'

    @http.route(_return_url, methods=['POST', 'GET'], type='http', auth='public', csrf=False)
    def phonepe_return_url(self, **response):
        _logger.info('PhonePe: Entering form_feedback with post data %s', pprint.pformat(response))
        return request.redirect('/payment/status')

    @http.route(_callback_url, methods=['POST'], type='http', auth='public', csrf=False)
    def phonepe_callback(self):
        data = request.get_json_data()
        _logger.info('PhonePe: Entering form_feedback with post data %s', pprint.pformat(data))
        if data.get('response'):
            response = data.get('response')
            pt_sudo = request.env['payment.transaction'].sudo()
            decode_response = pt_sudo._phonepe_decode_payload(response)
            tx_sudo = pt_sudo._get_tx_from_notification_data('phonepe', decode_response)
            header = request.httprequest.headers.get('X-VERIFY')
            self._verify_notification_signature(response, header, tx_sudo)
            tx_sudo._handle_notification_data('phonepe', decode_response)
        return ''

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
