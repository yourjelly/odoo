
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging

import requests
import uuid
from werkzeug.urls import url_encode

from odoo import _, fields, models
from odoo.exceptions import UserError
from odoo.tools import hmac
from odoo.addons.payment_stripe.const import API_VERSION

_logger = logging.getLogger(__name__)

DEFAULT_IAP_ENDPOINT = 'https://stripe.api.odoo.com/api/stripe'

class PaymentAcquirer(models.Model):
    _inherit = 'payment.acquirer'

    csrf_token = fields.Char(
        'CSRF Token', compute='_compute_csrf_token',
        help="This token can be used to verify that an incoming request from stripe provider has not been forged.")

    def _compute_csrf_token(self):
        for acquirer in self:
            acquirer.csrf_token = hmac(self.env(su=True), 'payment_stripe_connect-account-csrf-token', acquirer.id)

    # -------------------------------------------
    # Actions
    # -------------------------------------------
    def action_stripe_onboarding_account(self):
        stripe_onboarding_url = self._onboarding_url()
        if not stripe_onboarding_url:
            raise UserError(_("Unable to create a Stripe Account directly from your instance for the moment. Please create one from Stripe Website"))
        return {
            'type': 'ir.actions.act_url',
            'url': stripe_onboarding_url,
            'target': 'self',
        }

    def action_stripe_create_webhook(self):
        self._create_webhook()
        return True

    # -------------------------------------------
    # Business methods
    # -------------------------------------------
    def _stripe_call_proxy(self, api_method, payload=None, version=1):
        """ Calls the Stripe Connect proxy in order to follow Stripe Onboarding
            :param api_method: The Stripe Connect API method
            :param payload: The Stripe Connect API expected payload
            :param version: The Stripe Connect Proxy version
        """
        proxy_payload = {
            'jsonrpc': '2.0',
            'method': 'call',
            'params': {'payload': payload},
            'id': uuid.uuid4().hex,
        }
        endpoint = self.env['ir.config_parameter'].sudo().get_param('payment_stripe_connect.iap_endpoint', DEFAULT_IAP_ENDPOINT)
        base_url = '%s/%s/' % (endpoint, version)
        try:
            response = requests.post(url=base_url + api_method, json=proxy_payload, timeout=60)
            if response.status_code != 200:
                _logger.exception("unable to reach endpoint at %s, status_code: %s", response.status_code)
                raise Exception(_("Proxy error : %s, reason : %s.", response.status_code, response.reason))
            response_json = response.json()
            if 'error' in response_json:
                import pdb;pdb.set_trace()
                _logger.exception("unable to reach endpoint at %s, exception: %s", base_url + api_method, response_json['error']['debug'])
                raise Exception(_("Proxy error."))
            if 'error' in response_json['result'] and response_json['result']['error_code'] != 760:  # error_code = 760 : Proxy Disabled
                _logger.exception("Error during proxy call at %s, error_code: %s, error: %s", base_url + api_method,
                                  response_json['result']['error_code'], response_json['result']['error'])
                raise Exception(_("Stripe connection error."))
        except Exception as e:
            raise UserError(_("An unexpected error happened while connecting to Stripe :\n\n%s\n\nPlease retry or create your Stripe account manually.", e.args[0]))
        return response_json['result']

    def _onboarding_url(self):
        self.ensure_one()
        if self.provider != 'stripe':
            return super()._onboarding_url()
        account_id = self._get_stripe_account_id()
        return self._get_stripe_account_link(account_id)

    def _get_stripe_account_link(self, account_id):
        # account_links = self._stripe_call_proxy('account_links', payload={
        #     'account': account_id,
        #     'return_url': f'{self.company_id.get_base_url()}/payment/stripe/onboarding/return/{self.id}',
        #     'refresh_url': f'{self.company_id.get_base_url()}/payment/stripe/onboarding/refresh/{self.id}/{account_id}',
        #     'type': 'account_onboarding',
        # })
        # if account_links.get('error_code') == 760:
        #     return
        # if not account_links.get('url'):
        #     raise UserError(_("An unexpected error happened while connecting to Stripe. Please retry or create your Stripe account manually."))
        # return account_links.get('url')
        init_connect = self._stripe_call_proxy('init_connect', payload={
            'redirect_uri': f'{self.company_id.get_base_url()}/payment/stripe/onboarding/return/{self.id}',
            'token': self.csrf_token,
        })
        redirect_base_uri = self.env['ir.config_parameter'].sudo().get_param('payment_stripe_connect.iap_endpoint', DEFAULT_IAP_ENDPOINT)
        url_params = {
            'response_type': 'code',
            'client_id': init_connect['client_id'],
            'scope': 'read_write',
            'state': self.csrf_token,
            'redirect_uri': f"{redirect_base_uri}/1/{init_connect['redirect_uri']}",
            'stripe_user[email]': self.company_id.email,
            'stripe_user[url]': self.company_id.get_base_url(),
            'stripe_user[country]': self.company_id.country_id.code or '',
        }
        return 'https://connect.stripe.com/oauth/authorize?%s' % url_encode(url_params)

    def _get_stripe_account_id(self):
        # account = self._stripe_call_proxy('accounts', payload={'type': 'standard'})
        # if account.get('error_code') == 760:
        #     return
        # if not account.get('id'):
        #     raise UserError(_("An unexpected error happened while connecting to Stripe. Please retry or create your Stripe account manually."))
        # return account.get('id')
        return ''

    def _stripe_oauth_token(self, code):
        if self.stripe_secret_key or self.stripe_publishable_key:
            return
        oauth_response = self._stripe_call_proxy('oauth/token', payload={
            'grant_type': 'authorization_code',
            'code': code,
        })
        self.write({
            'stripe_secret_key': oauth_response.get('access_token'),
            'stripe_publishable_key': oauth_response.get('stripe_publishable_key'),
            'state': oauth_response.get('access_token') and oauth_response.get('stripe_publishable_key') and 'enabled' or 'disabled',
        })
        self._create_webhook()

    def _create_webhook(self, connect=False):
        if self.stripe_webhook_secret:
            return
        if 'localhost' in self.company_id.get_base_url():
            return
        webhook = self._stripe_make_request(
            'webhook_endpoints',
            payload={
                'url': self.company_id.get_base_url() + '/payment/stripe/webhook',
                'enabled_events[]': [
                    'checkout.session.completed',
                    # TODO TLE : For the moment, those events are not handled, ask ANV why ?
                    # 'checkout.session.async_payment_succeeded',
                    # 'checkout.session.async_payment_failed',
                    # 'charge.refunded',
                    # 'charge.refund.updated'
                ],
                'api_version': API_VERSION,
                'connect': connect,
            }
        )
        self.stripe_webhook_secret = webhook.get('secret')
