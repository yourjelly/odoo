# Part of Odoo. See LICENSE file for full copyright and licensing details.
import json
import logging
import requests

from datetime import timedelta
from functools import wraps
from werkzeug.urls import url_join

from odoo import _, api, fields, models
from odoo.exceptions import ValidationError

from odoo.addons.payment_careem.const import SUPPORTED_CURRENCIES
from odoo.addons.payment_careem.controllers.main import CareemPayController


_logger = logging.getLogger(__name__)


def check_access_token(func):
    @wraps(func)
    def wrapper(self, *args, **kwargs):
        if self.careem_access_token_expired:
            self._careem_set_access_token()
        return func(self, *args, **kwargs)
    return wrapper


class PaymentProvider(models.Model):
    _inherit = 'payment.provider'

    code = fields.Selection(selection_add=[('careem', 'Careem Pay')], ondelete={'careem': 'set default'})
    careem_access_token = fields.Char(string="Careem Access Token")
    careem_access_token_expiry = fields.Datetime(string="Careem Access Token Expiry")
    careem_access_token_expired = fields.Boolean(string="Is Careem Access Token Expired", compute="_compute_careem_access_token_expired")
    careem_client_secret_key = fields.Char(
        string="Careem Secret Key",
        required_if_provider="careem",
        groups="base.group_system"
    )
    careem_client_id = fields.Char(
        string="Careem Client Key",
        required_if_provider='careem',
        groups="base.group_system",
        help="The public client ID received from Careem. Obtained from Careem merchants onboarding."
    )

    # === BUSINESS METHODS === #

    def _careem_get_api_url(self, one_click=False):
        """ Return the URL of the API corresponding to the provider's state, URL can either be the one-click-pay
        checkout or the Identity endpoint.

        :return: The API URL.
        :rtype: str
        """
        self.ensure_one()
        if self.state == 'enabled':
            return 'https://merchant-gateway.careem.com/cpay/one-checkout/v1/' if one_click else 'https://identity.careem.com/'
        else:  # 'test'
            return 'https://merchant-gateway.qa.careem-engineering.com/cpay/one-checkout/v1/' if one_click else 'https://identity.qa.careem-engineering.com/'

    def _careem_get_redirection_url(self):
        """ Return the redirection URL of the API corresponding to the provider's state.

        :return: The API URL.
        :rtype: str
        """
        self.ensure_one()
        if self.state == 'enabled':
            return 'https://checkout.sandbox.cpay.me/oauth/sign-in/'
        else:  # 'test'
            return 'https://checkout.sandbox.cpay.me/oauth/sign-in/'

    # === COMPUTE METHODS ===#

    def _compute_feature_support_fields(self):
        """ Override of `payment` to enable additional features. """
        super()._compute_feature_support_fields()
        self.filtered(lambda p: p.code == 'careem').update({
            'support_express_checkout': True,
            'support_tokenization': True,
        })

    @api.depends('careem_access_token', 'careem_access_token_expiry')
    def _compute_careem_access_token_expired(self):
        has_expiry = self.filtered('careem_access_token_expiry')
        for record in has_expiry:
            record.careem_access_token_expired = record.careem_access_token_expiry < fields.Datetime.now()
        (self - has_expiry).careem_access_token_expired = True

    # === ACTION METHODS ===#

    def action_careem_create_access_token(self):
        """ Create an access token and return a feedback notification.

        :return: The feedback notification
        :rtype: dict
        """
        self.ensure_one()

        if not self.careem_access_token_expired:
            message = _("Your Careem Access Token is already set up.")
            notification_type = 'warning'
        elif not self.careem_client_id or not self.careem_client_secret_key:
            message = _("You cannot create a Careem Pay Access Token if your Careem Client and Secret key are not set.")
            notification_type = 'danger'
        else:
            self._careem_set_access_token()
            message = _("You Careem Pay Access Token successfully set up, expiring on %s!",
                        self.careem_access_token_expiry.strftime('%Y-%m-%d - %H:%M:%S'))
            notification_type = 'info'

        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'message': message,
                'sticky': False,
                'type': notification_type,
                'next': {'type': 'ir.actions.act_window_close'},  # Refresh the form to show the key
            }
        }

    # === BUSINESS METHODS ===#

    @check_access_token
    def _careem_get_invoice_id(self, minor_amount, currency_code, idempotency_key=None):
        self.ensure_one()
        base_url = self.get_base_url()
        response = self._careem_make_request(
            'invoices',
            headers={
                "Authorization": f"Bearer {self.careem_access_token}",
                "Content-Type": "application/json"
            },
            json_data={
                "total": {
                    "amount": minor_amount,
                    "currency": currency_code.upper()
                },
                "redirectUrls": {
                    "success": url_join(base_url, CareemPayController._redirect_url),
                    "failure": url_join(base_url, CareemPayController._redirect_url),
                },
                "webhookUrls": {
                    "success": url_join(base_url, CareemPayController._webhook_url),
                    "failure": url_join(base_url, CareemPayController._webhook_url),
                }
            },
            idempotency_key=idempotency_key
        )
        return response

    @check_access_token
    def _careem_fetch_invoice_data(self, transaction_id):
        self.ensure_one()
        response = self._careem_make_request(
            'invoices/%s' % transaction_id.provider_reference,
            method='GET',
            headers={
                "Authorization": f"Bearer {self.careem_access_token}",
            }
        )
        return response

    def _careem_set_access_token(self):
        """ Set the access token using the user's credentials """
        self.ensure_one()
        if self.code != 'careem' or not self.careem_client_id or not self.careem_client_secret_key:
            self.careem_access_token = False
            self.careem_access_token_expiry = False
        response = self._careem_make_request(
            'token',
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            payload={
                'client_id': self.careem_client_id,
                'client_secret': self.careem_client_secret_key,
                'grant_type': 'client_credentials'
            },
            one_click=False
        )
        if not response.get('access_token'):
            raise ValidationError("Careem Pay: " + _("Could not successfully get and set Careem's Access Token."))
        self.careem_access_token = response.get('access_token')
        self.careem_access_token_expiry = fields.Datetime.now() + timedelta(seconds=response.get('expires_in', 0))

    def _careem_make_request(
            self, endpoint, headers=None, payload=None, method='POST', json_data=None, offline=False, idempotency_key=None, one_click=True
    ):
        """ Make a request to Careem Pay API at the specified endpoint.

        Note: self.ensure_one()

        :param str endpoint: The endpoint to be reached by the request
        :param dict payload: The payload of the request
        :param str method: The HTTP method of the request
        :param dict json_data: The payload of request to be sent in JSON Format
        :param bool offline: Whether the operation of the transaction being processed is 'offline'
        :param str idempotency_key: The idempotency key to pass in the request
        :param bool one_click: Flag to identify which endpoint to use
        :return The JSON-formatted content of the response
        :rtype: dict
        :raise: ValidationError if an HTTP error occurs
        """
        self.ensure_one()

        url = url_join(self._careem_get_api_url(one_click), endpoint)
        headers = headers if headers else {}
        if method == 'POST' and idempotency_key:
            headers['X-Idempotency-Key'] = idempotency_key
        try:
            response = requests.request(method, url, data=payload, json=json_data, headers=headers, timeout=60)
            if not response.ok \
                    and not offline \
                    and 400 <= response.status_code < 500:  # The 'code' entry is sometimes missing
                try:
                    response.raise_for_status()
                except requests.exceptions.HTTPError as e:
                    _logger.exception("invalid API request at %s with data b%s", url, payload)
                    try:
                        error_msg = response.json().get('error_description', {})
                    except json.JSONDecodeError:
                        error_msg = e
                    raise ValidationError(
                        "Careem Pay: " + _(
                            "The communication with the API failed.\n"
                            "Careem Pay gave us the following info about the problem:\n'%s'", error_msg
                        )
                    )
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout):
            _logger.exception("unable to reach endpoint at %s", url)
            raise ValidationError("Careem Pay: " + _("Could not establish the connection to Careem Pay's API."))
        return response.json()

    @api.model
    def _get_compatible_providers(self, *args, currency_id=None, **kwargs):
        """ Override of payment to unlist Careem Pay providers for unsupported currencies. """
        providers = super()._get_compatible_providers(*args, currency_id=currency_id, **kwargs)
        currency = self.env['res.currency'].browse(currency_id).exists()
        if currency.name not in SUPPORTED_CURRENCIES:
            providers = providers.filtered(lambda r: r.code != "careem")
        return providers
