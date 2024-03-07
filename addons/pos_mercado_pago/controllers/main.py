# Part of Odoo. See LICENSE file for full copyright and licensing details.
import binascii
import hashlib
import hmac
import logging

from odoo import http
from odoo.http import request

_logger = logging.getLogger(__name__)


class PosMercadoPagoWebhook(http.Controller):
    @http.route('/pos_mercado_pago/notification', methods=['POST'], type="json", auth="none")
    def notification(self):
        """ Process the notification sent by Mercado Pago
        Notification format is always json
        """
        _logger.info('POST message received on the end point')

        # Check for mandatory keys in header
        x_request_id = request.httprequest.headers.get('X-Request-Id', None)
        x_signature = request.httprequest.headers.get('X-Signature', None)
        if not x_request_id or not x_signature:
            _logger.warning('POST message received with wrong header')
            return None

        # Check for payload
        data = request.get_json_data()
        if not data:
            _logger.warning('POST message received with no data')
            return None

        # If and only if this webhook is related with a payment intend (see payment_mercado_pago.js)
        # then the field data['additional_info']['external_reference'] contains a string
        # formated like "XXX_YYY" where "XXX" is the session_id and "YYY" is the payment_method_id
        external_reference = data.get('additional_info', {}).get('external_reference')

        if not external_reference or not self.validate_external_reference(external_reference):
            _logger.warning('POST message received with no or malformed "external_reference" key')
            return None

        session_id, payment_method_id = external_reference.split('_')

        pos_session_sudo = request.env['pos.session'].sudo().browse(int(session_id))
        if not pos_session_sudo or pos_session_sudo.state != 'opened':
            _logger.error("pos_session_sudo invalid")
            # This error is not related with Mercado Pago, simply acknowledge Mercado Pago message
            return request.make_json_response('[success]')

        payment_method_sudo = pos_session_sudo.config_id.payment_method_ids.filtered(lambda p: p.id == int(payment_method_id))
        if not payment_method_sudo or payment_method_sudo.use_payment_terminal != 'mercado_pago':
            _logger.error("wrong payment terminal")
            # This error is not related with Mercado Pago, simply acknowledge Mercado Pago message
            return request.make_json_response('[success]')

        # We have to check if this comes from Mercado Pago with the secret key
        secret_key = payment_method_sudo.mp_webhook_secret_key
        sig = x_signature.split(',')
        ts = sig[0].split('=')[1]
        v1 = sig[1].split('=')[1]
        signed_template = f"id:{data['id']};request-id:{x_request_id};ts:{ts};"
        cyphed_signature = binascii.hexlify(hmac.new(secret_key.encode(), signed_template.encode(), hashlib.sha256).digest())
        if cyphed_signature.decode() != v1:
            _logger.error('webhook authenticating failure')
            return None

        _logger.info('successfully authenticated webhook')
        _logger.info('POST message: %s', data)

        # Notify the frontend that we received a message from Mercado Pago
        request.env['bus.bus']._sendone(pos_session_sudo._get_bus_channel_name(), 'MERCADO_PAGO_LATEST_MESSAGE', {})

        # Acknowledge Mercado Pago message
        return request.make_json_response('[success]')

    def validate_external_reference(self, ext_ref):
        """
        An attacker can be aware of the 'external_reference' field existence and can corrupt it,
        hence we test the format
        """
        parts = ext_ref.split('_')
        if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
            return True
        return False
