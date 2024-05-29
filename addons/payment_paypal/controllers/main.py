# Part of Odoo. See LICENSE file for full copyright and licensing details.

import base64
import binascii
import logging
import pprint

import requests

from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives import hashes
from cryptography.x509 import load_pem_x509_certificate
from cryptography.exceptions import InvalidSignature

from werkzeug import urls
from werkzeug.exceptions import Forbidden

from odoo import _, http
from odoo.exceptions import ValidationError
from odoo.http import request
from odoo.tools import html_escape

from odoo.addons.payment import utils as payment_utils
from odoo.addons.payment_paypal import const


_logger = logging.getLogger(__name__)


class PaypalController(http.Controller):
    _complete_url = '/payment/paypal/complete_order'
    _webhook_url = '/payment/paypal/webhook/'

    @http.route(
        _complete_url, type='json', auth='public', methods=['POST'], csrf=False,
        save_session=False
    )
    def paypal_complete_order(self, provider_id, **kwargs):
        """
        Complete Paypal order and returns it as a JSON response.
        """
        try:
            provider_sudo = request.env['payment.provider'].browse(provider_id).sudo()
            response = provider_sudo._paypal_make_request(
                endpoint='/v2/checkout/orders/' + kwargs['order_id'] + '/' + kwargs['intent'],
            )
            normalized_response = self._normalize_paypal_response(response)
            tx_sudo = request.env['payment.transaction'].sudo()._get_tx_from_notification_data(
                'paypal', normalized_response
            )
            tx_sudo._handle_notification_data('paypal', normalized_response)
        except Forbidden:
            _logger.exception("Could not create transaction")

        return response

    @http.route(_webhook_url, type='http', auth='public', methods=['GET', 'POST'], csrf=False)
    def paypal_webhook(self, **data):
        """ Process the notification data sent by PayPal to the webhook.

        See https://developer.paypal.com/docs/api/webhooks/v1/.

        :param dict data: The notification data
        :return: An empty string to acknowledge the notification
        :rtype: str
        """
        data = request.httprequest.json
        if data.get('event_type') not in const.HANDLED_WEBHOOK_EVENTS:
            return
        normalized_data = self._normalize_paypal_response(
            data.get('resource'),
            is_webhook_origin=True,
        )
        _logger.info("notification received from PayPal with data:\n%s", pprint.pformat(data))
        try:
            # Check the origin and integrity of the notification
            tx_sudo = request.env['payment.transaction'].sudo()._get_tx_from_notification_data(
                'paypal', normalized_data
            )
            self._verify_notification_signature(data, tx_sudo)

            # Handle the notification data
            tx_sudo._handle_notification_data(
                'paypal',
                normalized_data,
            )
        except ValidationError:  # Acknowledge the notification to avoid getting spammed
            _logger.warning(
                "unable to handle the notification data; skipping to acknowledge", exc_info=True
            )
        return ''

    def _verify_notification_signature(self, data, tx_sudo):
        """
            Verify the signature received matches the message
            https://developer.paypal.com/api/rest/webhooks/rest/#link-selfverificationmethod
        """
        # Extract the necessary fields from headers
        headers = request.httprequest.headers.environ
        transmission_id = headers.get('HTTP_PAYPAL_TRANSMISSION_ID')
        time_stamp = headers.get('HTTP_PAYPAL_TRANSMISSION_TIME')
        signature = headers.get('HTTP_PAYPAL_TRANSMISSION_SIG')
        body = request.httprequest.data
        webhook_id = tx_sudo.provider_id.paypal_webhook_id
        # hex crc32 of raw event data, parsed to decimal form
        crc = int(binascii.crc32(body))
        # Construct the expected message to be encoded
        message = f"{transmission_id}|{time_stamp}|{webhook_id}|{crc}"
        # get the public key from the certificate file
        cert_pem = tx_sudo.provider_id._get_paypal_certificate(headers.get('HTTP_PAYPAL_CERT_URL'))
        # Create buffer from base64-encoded signature
        signature_buffer = base64.b64decode(signature)
        # Load public key certificate to verify the signature
        public_key = load_pem_x509_certificate(cert_pem.encode('utf-8')).public_key()

        try:
            public_key.verify(
                signature_buffer,
                message.encode('utf-8'),
                padding.PKCS1v15(),
                hashes.SHA256()
            )
            return True
        except InvalidSignature:
            _logger.warning("received notification with invalid signature")
            raise Forbidden()

    def _normalize_paypal_response(self, data, is_webhook_origin=False):
        result = {}
        purchase_unit = data.get('purchase_units')[0]
        result = {
            'payment_source': data.get('payment_source').keys(),
            'reference_id': purchase_unit.get('reference_id')
        }
        if is_webhook_origin:
            result.update({
                **purchase_unit,
                'txn_type': data.get('intent'),
                'id': data.get('id'),
                'status': data.get('status'),
            })
        else:
            captured = purchase_unit.get('payments').get('captures')
            authorized = purchase_unit.get('payments').get('authorizes')
            if captured:
                result.update({
                    **captured[0],
                    'txn_type': const.CAPTURE,
                })
            elif authorized:
                result.update({
                    **authorized[0],
                    'txn_type': const.AUTHORIZE,
                })
            else:
                raise ValidationError(_("PayPal: Invalid response format, can't normalize"))
        return result
