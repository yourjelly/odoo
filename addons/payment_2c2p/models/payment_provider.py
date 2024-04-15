import jwt
import logging
import pprint
import requests

from odoo import _, fields, models
from odoo.exceptions import ValidationError

from odoo.addons.payment_2c2p import const


_logger = logging.getLogger(__name__)


class PaymentProvider(models.Model):
    _inherit = "payment.provider"

    code = fields.Selection(selection_add=[('2c2p', '2C2P')], ondelete={'2c2p': 'set default'})

    tctp_secret_key = fields.Char("2C2P Secret Key", groups="base.group_system", required_if_provider='2c2p')
    tctp_merchant_id = fields.Char("2C2P Merchant ID", groups="base.group_system", required_if_provider='2c2p')

    # === BUSINESS METHODS ===#

    def _get_supported_currencies(self):
        """ Override of `payment` to return the supported currencies. """
        supported_currencies = super()._get_supported_currencies()
        if self.code == '2c2p':
            supported_currencies = supported_currencies.filtered(
                lambda c: c.name in const.SUPPORTED_CURRENCIES
            )
        return supported_currencies

    def _get_default_payment_method_codes(self):
        """ Override of `payment` to return the default payment method codes. """
        default_codes = super()._get_default_payment_method_codes()
        if self.code != '2c2p':
            return default_codes
        return const.DEFAULT_PAYMENT_METHODS_CODES

    def _tctp_make_request(self, payload=None):
        """ Make a request to 2C2P API and return the JSON-formatted content of the response.

        Note: self.ensure_one()

        :param dict payload: The payload of the request.
        :return The JSON-formatted content of the response.
        :rtype: dict
        :raise ValidationError: If an HTTP error occurs.
        """
        if self.state == 'enabled':
            url = 'https://pgw.2c2p.com/payment/4.3/paymentToken'
        else:
            url = 'https://sandbox-pgw.2c2p.com/payment/4.3/paymentToken'

        payload_jwt = jwt.encode(payload, self.tctp_secret_key, headers={"alg": "HS256", "typ": "JWT"})
        try:
            response = requests.post(url, json={'payload': payload_jwt}, timeout=10)
            response.raise_for_status()
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout):
            _logger.exception("Unable to reach endpoint at %s", url)
            raise ValidationError("2C2P: " + _("Could not establish the connection to the API."))

        response_json = response.json()
        resp_code = response_json.get('respCode')
        if resp_code and resp_code != '0000':
            _logger.exception(
                "Invalid API request at %s with data:\n%s", url, pprint.pformat(payload)
            )
            raise ValidationError(
                "2C2P: " + _(
                    "The communication with the API failed. 2C2P gave us the following information:\n"
                    "respCode: %s\nrespDesc: %s", resp_code, response_json.get('respDesc')
                )
            )

        return jwt.decode(response_json.get('payload'), self.tctp_secret_key, algorithms=['HS256'])
