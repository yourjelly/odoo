import jwt
import requests
import logging
from odoo import _, api, fields, models
from odoo.addons.payment_2c2p.const import SUPPORTED_CURRENCIES, API_URLS, DEFAULT_PAYMENT_METHODS_CODES
from odoo.exceptions import ValidationError

_logger = logging.getLogger(__name__)


class PaymentProvider(models.Model):
    _inherit = "payment.provider"

    code = fields.Selection(
        selection_add=[('2c2p', '2C2P')],
        ondelete={'2c2p': 'set default'}
    )

    tctp_secret_key = fields.Char("2C2P Secret Key", groups="base.group_system")
    tctp_merchant_id = fields.Char("2C2P Merchant ID", groups="base.group_system")

    def _2c2p_make_request(self, api_obj, payload=None, endpoint_param=None):
        """ All API requests to 2c2p to be done here. Error handling for most issues will be done here

        :param api_obj: 2c2p object to be interacted with, will fetch the corresponding API URL
        :param payload: data to be passed if POST request is done
        :param endpoint_param: extra param of URL needed to supply the endpoint

        :return Response object in dictionary format
        """
        url = self._2c2p_get_api_url(api_obj)
        if not url:
            raise ValidationError("Invalid API object %s, typo or not registered", api_obj)
        if endpoint_param:
            url = url.format(**endpoint_param)

        payload_jwt = jwt.encode(payload, self.tctp_secret_key, headers={"alg": "HS256", "typ": "JWT"})
        try:
            response = requests.post(url, json={'payload': payload_jwt}, headers={'Content-Type': 'application/json'})
            response.raise_for_status()
        except requests.exceptions.ConnectionError:
            raise ValidationError("2C2P: Could not establish connection to the API at %s" % url)
        
        response_json = response.json()
        if response_json.get('respCode') and response_json.get('respCode') != '0000':
            raise ValidationError("2C2P: Invalid API request at %s with_date: %s\nResponse: %s" % (url, payload, response_json))
        
        response_payload = jwt.decode(response_json.get('payload'), self.tctp_secret_key, algorithms=['HS256'])
        _logger.info("2C2P: Response payload: %s", response_payload)
        return response_payload

    @api.model
    def _get_compatible_providers(self, *args, currency_id=None, **kwargs):
        """Override of `payment` to filter out 2c2p for unsupported currencies"""
        providers = super()._get_compatible_providers(*args, currency_id=currency_id, **kwargs)
        currency = self.env['res.currency'].browse(currency_id)
        if currency and currency.name not in SUPPORTED_CURRENCIES:
            providers = providers.filtered(lambda p: p.code != '2c2p')

        return providers

    def _get_default_payment_method_codes(self):
        """ Override of `payment` to return the default payment method codes. """
        default_codes = super()._get_default_payment_method_codes()
        if self.code != '2c2p':
            return default_codes
        return DEFAULT_PAYMENT_METHODS_CODES

    @api.model
    def _tctp_decode_jwt_payload(self, payload):
        """ Decode the JWT payload and return the decoded data
            We need to go through every 2c2p provider as we cannot know which one is the correct one

        :param payload: JWT payload to be decoded
        :return: Decoded payload in dictionary format
        """
        tctp_providers_sudo = self.env['payment.provider'].sudo().search([('code', '=', '2c2p')])
        for provider_sudo in tctp_providers_sudo:
            try:
                return jwt.decode(payload, provider_sudo.tctp_secret_key, algorithms=['HS256'])
            except jwt.exceptions.DecodeError:
                continue
        raise ValidationError("2C2P: Unable to decode JWT payload")

    def _2c2p_get_api_url(self, api_obj):
        """ Return the URL of the API corresponding to the provider's state.

        :return: The API URL.
        :rtype: str
        """
        self.ensure_one()

        environment = 'production' if self.state == 'enabled' else 'test'
        return API_URLS[environment].get(api_obj)
