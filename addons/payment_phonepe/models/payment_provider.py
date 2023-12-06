from odoo import _, api, fields, models
from odoo import http, _
import json
import base64
from odoo.http import request
import requests
import hashlib
import logging
from odoo.addons.payment_phonepe import const
from werkzeug.urls import url_join
_logger = logging.getLogger(__name__)


class PaymentProvider(models.Model):
    _inherit = 'payment.provider'

    code = fields.Selection(
        selection_add=[('phonepe', "PhonePe")], ondelete={'phonepe': 'set default'}
    )
    phonepe_merchant_id = fields.Char(
        string="PhonePe Merchant ID",
        help="Unique Merchant ID assigned to the merchant by PhonePe",
        required_if_provider='phonepe',
    )
    phonepe_salt_key = fields.Char(
        string="PhonePe Salt Key",
        help="Salt key provided by PhonePe",
        required_if_provider='phonepe',
    )
    phonepe_salt_index = fields.Integer(
        string="PhonePe Salt Index",
        help="Salt index provided by PhonePe",
        required_if_provider='phonepe',
    )
    phonepe_checksum = fields.Char(string='PhonePe Checksum')

    def _calculate_checksum(self, payload):
        """ Calculate checksum for the rendering_values data. """
        a = json.dumps(payload)
        base64_payload = base64.b64encode(a.encode()).decode()
        checksum_string = base64_payload + "/pg/v1/pay"

        checksum_string += self.phonepe_salt_key

        checksum = (
            hashlib.sha256(checksum_string.encode()).hexdigest()
            + "###"
            + str(self.phonepe_salt_index)
        )
        self.phonepe_checksum = checksum
        return checksum, base64_payload

    def _phonepe_make_request(self, endpoint, payload=None, method='POST'):
            """ Make a request to PhonePe API. """
            self.ensure_one()
            if not payload:
                payload = {}

            url = url_join('https://api-preprod.phonepe.com/apis/pg-sandbox/', endpoint)  # for testing
            checksum, base64_payload = self._calculate_checksum(payload)
            # url = ' https://api.phonepe.com/apis/hermes' for production
            headers = {
                'Content-Type': 'application/json',
                'accept': 'application/json',
                'X-VERIFY': checksum,
            }
            payload = {"request": base64_payload}
            try:
                if method == 'POST':
                    response = requests.post(url, json=payload, headers=headers)
                    if response.status_code == 200:
                        return response.json()
                    else:
                        _logger.error("Payment failed with status code: %s", response.status_code)
                        return {'error': 'Payment failed'}
            except Exception as e:
                _logger.error("Error making PhonePe request: %s", str(e))
                return {'error': 'An error occurred during payment processing'}

    def _get_supported_currencies(self):
        print("_get_supported_currencies \n\n\n")
        """ Override of `payment` to return the supported currencies. """
        supported_currencies = super()._get_supported_currencies()
        if self.code == 'phonepe':
            supported_currencies = supported_currencies.filtered(
                lambda c: c.name in const.SUPPORTED_CURRENCIES
            )
        return supported_currencies

    def _get_default_payment_method_codes(self):
        print("_get_default_payment_method_codes \n\n\n")
        """ Override of `payment` to return the default payment method codes. """
        default_codes = super()._get_default_payment_method_codes()
        if self.code != 'phonepe':
            return default_codes
        return const.DEFAULT_PAYMENT_METHODS_CODES



