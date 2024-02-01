# Part of Odoo. See LICENSE file for full copyright and licensing details.
import binascii
import hashlib
import hmac
import json
import logging

from odoo import http
from odoo.http import request

_logger = logging.getLogger(__name__)

class Webhook(http.Controller):
    @http.route('/pos_mercado_pago/notification', methods=['POST'], type="http", auth="none", csrf=False)
    def notification(self):
        """ Process the notification sent by Mercado Pago

        Notification format is always json
        """
        # We received something on this endpoint, this can be a Mercado Pago notification or a spam
        _logger.info('Webhook: POST message received on the end point')

        if request.httprequest.data:
            data = json.loads(request.httprequest.data)
            _logger.info('Webhook: POST message: %s', data)
            # If and only if this webhook is related with a payment intend (see payment_mercado_pago.js)
            # then the field data['additional_info']['external_reference'] contains a string
            # formated like "XXX_YYY" where "XXX" is the session_id and "YYY" is the payment_method_id
            external_reference = data.get('additional_info', {}).get('external_reference')

            if external_reference and self.validate_external_reference(external_reference):
                # Ack 200 for Mercado Pago
                def respond_with_success():
                    request.make_json_response('[success]')

                session_id, payment_method_id = external_reference.split('_')

                pos_session_sudo = request.env['pos.session'].sudo().browse(int(session_id))
                if not pos_session_sudo or pos_session_sudo.state != 'opened':
                    _logger.error("Webhook: pos_session_sudo invalid")
                    # Error, simply acknowledge Mercado Pago message
                    return respond_with_success()

                payment_method_sudo = pos_session_sudo.config_id.payment_method_ids.filtered(lambda p: p.id == int(payment_method_id))
                if not payment_method_sudo or payment_method_sudo.use_payment_terminal != 'mercado_pago':
                    _logger.error("Webhook: wrong payment terminal")
                    # Error, simply acknowledge Mercado Pago message
                    return respond_with_success()

                # We have to check if this comes from Mercado Pago with the secret key
                secret_key = payment_method_sudo.mp_webhook_secret_key
                request_id = request.httprequest.headers['X-Request-Id']
                sig = request.httprequest.headers['X-Signature'].split(',')
                ts = sig[0].split('=')[1]
                v1 = sig[1].split('=')[1]
                signed_template = f"id:{data['id']};request-id:{request_id};ts:{ts};"
                cyphed_signature = binascii.hexlify(hmac.new(secret_key.encode(), signed_template.encode(), hashlib.sha256).digest())

                if cyphed_signature.decode() == v1:
                    _logger.info('Webhook: successfully authenticated Mercado Pago')
                    # Save this response, it contains the last payment status
                    payment_method_sudo.mp_last_payment_intend = data
                    # Notify the frontend that we received a message from Mercado Pago
                    request.env['bus.bus']._sendone(pos_session_sudo._get_bus_channel_name(), 'MERCADO_PAGO_LATEST_MESSAGE', {})
                    # Acknowledge Mercado Pago message
                    return respond_with_success()
                else:
                    _logger.error('Webhook: failure authenticating Mercado Pago')

    def validate_external_reference(self, ref):
        """
        An attacker can be aware of the 'external_reference' field existence, then we test the format
        """
        parts = ref.split('_')
        if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
            return True
        return False
