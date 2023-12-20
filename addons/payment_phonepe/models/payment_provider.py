# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
import requests
import pprint
import json

from odoo import _, fields, models
from odoo.addons.payment_phonepe import const
from odoo.exceptions import ValidationError

_logger = logging.getLogger(__name__)

class PaymentProvider(models.Model):
    _inherit = 'payment.provider'

    code = fields.Selection(selection_add=[('phonepe', 'PhonePe')], ondelete={'phonepe': 'set default'})
    phonepe_merchant_id = fields.Char(string='PhonePe Merchant ID', required_if_provider='phonepe', groups='base.group_user', default="PGTESTPAYUAT")
    phonepe_salt_key = fields.Char(string='PhonePe Salt key', required_if_provider='phonepe', groups='base.group_user', default="099eb0cd-02cf-4e2a-8aca-3e6c6aff0399")
    phonepe_salt_index = fields.Char(string='PhonePe Salt Index', required_if_provider='phonepe', groups='base.group_user', default="1")

    # === BUSINESS METHODS ===#

    def _get_supported_currencies(self):
        """ Override of `payment` to return the supported currencies. """
        supported_currencies = super()._get_supported_currencies()
        if self.code == 'phonepe':
            supported_currencies = supported_currencies.filtered(
                lambda c: c.name in const.SUPPORTED_CURRENCIES
            )
        return supported_currencies

    def _phonepe_get_api_url(self):
        """ Return the URL of the API corresponding to the provider's state.
        :return: The API URL.
        :rtype: str
        """
        self.ensure_one()
        environment = 'production' if self.state == 'enabled' else 'test'
        api_url = const.API_URLS[environment]
        return api_url

    def _phonepe_make_request(self, method='POST', data=None, headers=None):
        """
        """
        self.ensure_one()
        url = "%s%s" % (self._phonepe_get_api_url(), const.END_POINT) if not transactionId else "%s/pg/v1/status/%s/%s" % (self._phonepe_get_api_url(), self.phonepe_merchant_id, transactionId)
        try:
            data = json.dumps(data)
            response = requests.request(method, url=url, data=data, headers=headers, timeout=60)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError:
            _logger.exception(
                "Invalid API request at %s with data:\n%s", url, pprint.pformat(data)
            )
            raise ValidationError(
                "PhonePe: " + _(
                    "The communication with the API failed. PhonePe gave us the following "
                    "information: %s", response.json()
                ))
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout):
            _logger.exception("Unable to reach endpoint at %s", url)
            raise ValidationError(
                "PhonePe: " + _("Could not establish the connection to the API.")
            )

    def _get_default_payment_method_codes(self):
        """ Override of `payment` to return the default payment method codes. """
        default_codes = super()._get_default_payment_method_codes()
        if self.code != 'phonepe':
            return default_codes
        return const.DEFAULT_PAYMENT_METHODS_CODES
