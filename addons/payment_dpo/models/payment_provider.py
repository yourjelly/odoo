# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
import pprint

import requests
import xml.etree.ElementTree as ET

from odoo import _, fields, models
from odoo.exceptions import ValidationError

from odoo.addons.payment_dpo import const


_logger = logging.getLogger(__name__)


class PaymentProvider(models.Model):
    _inherit = ['payment.provider']

    code = fields.Selection(
        selection_add=[('dpo', "DPO")], ondelete={'dpo': 'set default'}
    )
    dpo_company_token = fields.Char(string="Company Token", required_if_provider='dpo')
    dpo_service = fields.Char(string="Service ID", required_if_provider='dpo')
    dpo_endpoint = fields.Char(string="Endpoint", required_if_provider='dpo')
    dpo_payment_url = fields.Char(string="Payment URL", required_if_provider='dpo')

    # # === BUSINESS METHODS === #

    def _dpo_make_request(self, payload=None, method='POST'):
        """ Make a request to DPO API to create the Transaction Token.

        Note: self.ensure_one()

        :param dict payload: The payload of the request.
        :param str method: The HTTP method of the request.
        :return: The JSON-formatted content of the response.
        :rtype: dict
        :raise ValidationError: If an HTTP error occurs.
        """
        self.ensure_one()

        url = self.dpo_endpoint
        content_type = 'application/xml; charset=utf-8' if method == 'POST' else ''
        headers = {
            'Content-Type': content_type
        }

        try:
            response = requests.request(method, url, data=payload, headers=headers, timeout=10)
            try:
                response.raise_for_status()
            except requests.exceptions.HTTPError:
                _logger.exception(
                    "Invalid API request at %s with data:\n%s", url, pprint.pformat(payload)
                )
                # TODO-DPO parse the response (xml) to extract error message
                # msg = ', '.join(
                #     [error.get('message', '') for error in response.json().get('errors', [])]
                # )
                # raise ValidationError(
                #     "DPO: " + _("The communication with the API failed. Details: %s", msg)
                # )
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout):
            _logger.exception("Unable to reach %s", url)
            raise ValidationError(
                "DPO: " + _("Could not establish the connection to the API.")
            )
        root = ET.fromstring(response.content.decode('utf-8'))
        transaction_data = {element.tag: element.text for element in root}

        return transaction_data

    def _get_default_payment_method_codes(self):
        """ Override of `payment` to return the default payment method codes. """
        default_codes = super()._get_default_payment_method_codes()
        if self.code != 'dpo':
            return default_codes
        return const.DEFAULT_PAYMENT_METHOD_CODES
