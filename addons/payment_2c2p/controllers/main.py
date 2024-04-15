# Part of Odoo. See LICENSE file for full copyright and licensing details.

import jwt
import logging
import pprint

from odoo import http
from odoo.exceptions import ValidationError
from odoo.http import request


_logger = logging.getLogger(__name__)


class TctpController(http.Controller):
    @http.route('/payment/2c2p/return', type='http', methods=['GET'], auth='public')
    def tctp_return_from_checkout(self):
        return request.redirect('/payment/status')

    @http.route('/payment/2c2p/notification/<int:provider_id>', type='http', methods=['POST'], auth='public', csrf=False)
    def tctp_webhook(self, provider_id):
        """ Process notification sent by 2c2p when a transaction is updated """
        payload = request.get_json_data().get('payload', '')
        provider_sudo = request.env['payment.provider'].sudo().browse(provider_id).exists()
        try:
            data = jwt.decode(payload, provider_sudo.tctp_secret_key, algorithms=['HS256'])
            _logger.info("Notification received from 2C2P with data:\n%s", pprint.pformat(data))
        except ValidationError:
            _logger.exception("""
                Notification received from 2C2P with data:\n%s\n\n
                Unable to decode notification data; skipping to acknowledge.
            """, pprint.pformat(payload))
            return request.make_json_response(['accepted'], status=200)

        try:
            tx_sudo = request.env['payment.transaction'].sudo()._get_tx_from_notification_data('2c2p', data)
            tx_sudo._process_notification_data(data)
        except ValidationError:
            _logger.exception("Unable to handle notification data; skipping to acknowledge.")

        return request.make_json_response(['accepted'], status=200)
