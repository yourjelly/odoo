# Part of Odoo. See LICENSE file for full copyright and licensing details.

import hmac
import logging
import pprint
import base64
import json

from werkzeug.exceptions import Forbidden

from odoo import http
from odoo.exceptions import ValidationError
from odoo.http import request


_logger = logging.getLogger(__name__)


class PhonePeController(http.Controller):
    _return_url = '/payment/phonepe/return'
    _callback_url = '/payment/phonepe/callback'

    @http.route(
        _return_url, type='http', auth='public', methods=['GET', 'POST'], csrf=False,
        save_session=False
    )
    def phonepe_return_from_checkout(self, reference, **data):
        """ Process the notification data sent by Phonepe after redirection from checkout.

        :param str reference: The transaction reference embedded in the return URL.
        :param dict data: The notification data.
        """
        # breakpoint()
        tx_sudo = request.env['payment.transaction'].sudo()._get_tx_from_notification_data(
                'phonepe', {'description': reference}
            )  # Use the same key as for webhook notifications' data.

            # Handle the notification data.
        tx_sudo._handle_notification_data('phonepe', data)
        return request.redirect('/payment/status')

    @http.route(
        _callback_url, type='http', auth='public', methods=['GET', 'POST'], csrf=False,
    )
    def get_callback_parameters(self, **response):
        breakpoint()
        # response = {'response': 'ewogICJzdWNjZXNzIjogdHJ1ZSwKICAiY29kZSI6ICJQQVlNRU5UX1NVQ0NFU1MiLAogICJtZXNzYWdlIjogIllvdXIgcmVxdWVzdCBoYXMgYmVlbiBzdWNjZXNzZnVsbHkgY29tcGxldGVkLiIsCiAgImRhdGEiOiB7CiAgICAibWVyY2hhbnRJZCI6ICJQR1RFU1RQQVlVQVQiLAogICAgIm1lcmNoYW50VHJhbnNhY3Rpb25JZCI6ICJNVDc4NTA1OTAwNjgxODgxMDQiLAogICAgInRyYW5zYWN0aW9uSWQiOiAiVDIxMTEyMjE0Mzc0NTYxOTAxNzAzNzkiLAogICAgImFtb3VudCI6IDEwMCwKICAgICJzdGF0ZSI6ICJDT01QTEVURUQiLAogICAgInJlc3BvbnNlQ29kZSI6ICJTVUNDRVNTIiwKICAgICJwYXltZW50SW5zdHJ1bWVudCI6IHsKICAgICAgInR5cGUiOiAiVVBJIiwKICAgICAgInV0ciI6ICIyMDYzNzg4NjYxMTIiCiAgICB9CiAgfQp9Cg=='}
        response_data = response.get('response', '')
        payment_provider = request.env['payment.provider'].sudo().search([('code', '=', 'phonepe')], limit=1)
        stored_checksum = payment_provider.phonepe_checksum
        received_signature = request.httprequest.headers.get('X-Verify')
        if stored_checksum == received_signature:
            decoded_response = base64.b64decode(response_data).decode('utf-8')
            json_response = json.loads(decoded_response)
            _logger.info("notification received with data:\n%s", pprint.pformat(json_response))
        else:
            _logger.info("Received data with invalid checksum")

            