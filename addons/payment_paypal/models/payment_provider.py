# Part of Odoo. See LICENSE file for full copyright and licensing details.

import json
import logging
import requests

from datetime import datetime, timedelta
from werkzeug import urls

from odoo import _, fields, models

from odoo.addons.payment_paypal import const
from odoo.addons.payment_paypal.controllers.main import PaypalController
from odoo.exceptions import AccessError, ValidationError


_logger = logging.getLogger(__name__)


class PaymentProvider(models.Model):
    _inherit = 'payment.provider'

    code = fields.Selection(
        selection_add=[('paypal', "Paypal")], ondelete={'paypal': 'set default'}
    )
    paypal_email_account = fields.Char(
        string="Email",
        help="The public business email solely used to identify the account with PayPal",
        required_if_provider='paypal',
        default=lambda self: self.env.company.email,
    )
    paypal_client_id = fields.Char(
        string="Client ID",
        help="Client ID found on the paypal dashboard",
        required_if_provider='paypal',
    )
    paypal_client_secret = fields.Char(
        string="Client Secret",
        help="Client ID found on the paypal dashboard",
        groups='base.group_system'
    )

    paypal_access_token = fields.Char(
        string="Paypal Access Token",
        help="The short-lived token used to access Paypal APIs",
    )
    paypal_access_token_expiry = fields.Datetime(
        string="Paypal Access Token Expiry",
        help="The moment at which the token becomes invalid.",
        default='1970-01-01',
    )
    paypal_webhook_id = fields.Char(string="Paypal Webhook")
    paypal_certificate_url = fields.Char(string="Paypal public certificate URL")
    paypal_certificate = fields.Char(string="Paypal public certificate")

    # === COMPUTE METHODS === #

    # def _compute_feature_support_fields(self):
    #     """ Override of `payment` to enable additional features. """
    #     super()._compute_feature_support_fields()
    #     self.filtered(lambda p: p.code == 'paypal').update({
    #         'support_manual_capture': 'full_only',
    #     })

    #=== BUSINESS METHODS ===#

    def _get_supported_currencies(self):
        """ Override of `payment` to return the supported currencies. """
        supported_currencies = super()._get_supported_currencies()
        if self.code == 'paypal':
            supported_currencies = supported_currencies.filtered(
                lambda c: c.name in const.SUPPORTED_CURRENCIES
            )
        return supported_currencies

    def _paypal_get_api_url(self):
        """ Return the API URL according to the provider state.

        Note: self.ensure_one()

        :return: The API URL
        :rtype: str
        """
        self.ensure_one()

        if self.state == 'enabled':
            return 'https://api-m.paypal.com'
        else:
            return 'https://api-m.sandbox.paypal.com'

    def _get_default_payment_method_codes(self):
        """ Override of `payment` to return the default payment method codes. """
        default_codes = super()._get_default_payment_method_codes()
        if self.code != 'paypal':
            return default_codes
        return const.DEFAULT_PAYMENT_METHOD_CODES

    def _get_normalized_paypal_email_account(self):
        # Remove unicode characters such as \u200b coming from pasted emails
        return self.paypal_email_account.encode('ascii', 'ignore').decode('utf-8')

    def _paypal_get_inline_form_values(self, currency=None):
        """ Return a serialized JSON of the required values to render the inline form.

        Note: `self.ensure_one()`

        :param res.currency currency: The transaction currency.
        :return: The JSON serial of the required values to render the inline form.
        :rtype: str
        """
        intent = const.AUTHORIZE if self.capture_manually else const.CAPTURE
        inline_form_values = {
            'client_id': self.paypal_client_id,
            'currency': currency and currency.name,
            'intent': intent.lower(),
            'provider_id': self.id,
        }
        return json.dumps(inline_form_values)

    def _paypal_make_request(
        self, endpoint, payload=None, method='POST', get_token=False,
        create_webhook=False, **kwargs
    ):
        """ Make a request to Paypal API at the specified endpoint.

        Note: self.ensure_one()

        :param str endpoint: The endpoint to be reached by the request
        :param dict payload: The payload of the request
        :param str method: The HTTP method of the request
        :param bool get_token: determine if we are currently getting token
        :param bool create_webhook: determine if we are currently creating a webhook

        :return: The JSON-formatted content of the response
        :rtype: dict
        :raise: ValidationError if an HTTP error occurs
        """

        url = self._paypal_get_api_url() + endpoint
        headers = {
            'Content-type': 'application/json',
        }
        if not get_token:
            if not (access_token := self._get_access_token()):
                raise ValidationError(_("PayPal: Can't get access token"))
            headers['Authorization'] = 'Bearer %s' % (access_token)

        try:
            response = requests.request(
                method, url,
                json=payload,
                headers=headers,
                timeout=10,
                **kwargs,
            )
            try:
                response.raise_for_status()
            except requests.exceptions.HTTPError:
                # PayPal errors https://developer.paypal.com/api/rest/reference/orders/v2/errors/
                _logger.exception(
                    "invalid API request at %s with data %s: %s", url, payload, response.text
                )
                if response.status_code == 403:
                    raise AccessError(_("PayPal: The authentication with the API failed."))
                msg = response.json().get('message', '')
                raise ValidationError(
                    _("PayPal: The communication with the API failed. Details: %s", msg)
                )
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout):
            _logger.exception("unable to reach endpoint at %s", url)
            raise ValidationError(_("PayPal: Could not establish the connection to the API."))
        if not get_token and not create_webhook and not self.paypal_webhook_id:
            self._create_webhook()
        return response.json()

    def _get_access_token(self):
        if datetime.utcnow() > self.paypal_access_token_expiry - timedelta(minutes=5):
            response_content = self._paypal_make_request(
                '/v1/oauth2/token',
                get_token=True,
                data={'grant_type': 'client_credentials'},
                auth=(self.paypal_client_id, self.paypal_client_secret),
            )
            self.write({
                'paypal_access_token': response_content['access_token'],
                'paypal_access_token_expiry': datetime.utcnow() + timedelta(
                    seconds=response_content['expires_in']
                ),
            })
        return self.paypal_access_token

    def _create_webhook(self):
        try:
            base_url = self.get_base_url()
            # # webhook is not created on localhost
            # if base_url.startswith('http://localhost'):
            # # insert ngrok url here
            #     base_url = 'https://c873-94-140-169-33.ngrok-free.app'
            data = {
                'url': urls.url_join(base_url, PaypalController._webhook_url),
                'event_types': [{'name': event_type} for event_type in const.HANDLED_WEBHOOK_EVENTS]
            }
            webhook = self._paypal_make_request(
                '/v1/notifications/webhooks',
                payload=data,
                create_webhook=True,
            )
            self.paypal_webhook_id = webhook.get("id")
        except ValidationError:
            _logger.exception("Could not create webhook")

    def _get_paypal_certificate(self, url):
        if not self.paypal_certificate or url != self.paypal_certificate_url:
            # caching the certificate to avoid getting it unnecessarily
            self.paypal_certificate_url = url
            self.paypal_certificate = requests.get(url).text
        return self.paypal_certificate
