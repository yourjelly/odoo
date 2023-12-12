import pprint

from odoo.exceptions import ValidationError
from odoo.http import request
from odoo import http
from odoo.addons.payment_2c2p.const import PAYMENT_METHODS_MAPPING

from werkzeug import urls

import logging
_logger = logging.getLogger(__name__)


class XenditController(http.Controller):

    _webhook_url = '/payment/2c2p/notification'
    _return_url = '/payment/2c2p/return'

    @http.route('/payment/2c2p/payment_methods', type='json', auth='public')
    def tctp_create_invoice(self, provider_id, amount, reference, currency_id, partner_id=None, payment_method_code=None, payment_option_id=None, **kwargs):
        """ Create a payment token request on 2c2p which will return the paymentToken and a webPaymentUrl
        https://developer.2c2p.com/docs/api-payment-token#section-payment-token-request
        params: https://developer.2c2p.com/docs/api-payment-token-request-parameter
        """

        provider_sudo = request.env['payment.provider'].sudo().browse(provider_id)
        base_url = provider_sudo.get_base_url()
        currency_code = request.env['res.currency'].browse(currency_id).name
        partner_sudo = partner_id and request.env['res.partner'].sudo().browse(partner_id).exists()

        payload = {
            'merchantID': provider_sudo.tctp_merchant_id,
            'invoiceNo': reference,
            'description': reference,
            'amount': amount,
            'currencyCode': currency_code,
            'uiParams': {
                'userInfo': {
                    'name': partner_sudo.name,
                },
            },
            'frontendReturnUrl': urls.url_join(base_url, self._return_url),
            'backendReturnUrl': urls.url_join(base_url, self._webhook_url),
        }

        if partner_sudo.mobile or partner_sudo.phone:
            payload['uiParams']['userInfo']['mobileNo'] = partner_sudo.mobile or partner_sudo.phone
        if partner_sudo.email:
            payload['uiParams']['userInfo']['email'] = partner_sudo.email
        if payment_method_code:
            payload['paymentChannel'] = [PAYMENT_METHODS_MAPPING.get(payment_method_code, payment_method_code)]

        checkout_url = provider_sudo._2c2p_make_request('paymentToken', payload=payload).get('webPaymentUrl')
        if not checkout_url:
            raise ValidationError("Issue on invoice creation on 2C2P! No checkout URL received!")

        return {
            "type": "ir.actions.act_url",
            "url": checkout_url,
            "target": "new",
        }
    
    @http.route(_return_url, type='http', auth='public', methods=['GET'])
    def tctp_return_from_checkout(self, **data):
        """ 2c2p will redirect the user to this route after the payment is done"""
        return request.redirect('/payment/status')

    @http.route(_webhook_url, type='http', methods=['POST'], auth='public', csrf=False)
    def tctp_webhook(self):
        """ Process notification sent by 2c2p when a transaction is updated """
        data = request.env['payment.provider']._tctp_decode_jwt_payload(request.get_json_data().get('payload', ''))
        _logger.info("Received callback from 2C2P: %s", pprint.pformat(data))

        tx_sudo = request.env['payment.transaction'].sudo()._get_tx_from_notification_data('2c2p', data)
        tx_sudo._process_notification_data(data)

        return request.make_json_response('')
