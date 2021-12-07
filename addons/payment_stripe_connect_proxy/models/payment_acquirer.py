
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging

import requests
import uuid

from odoo import _, models
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)

DEFAULT_IAP_ENDPOINT = 'https://stripe.api.odoo.com/api/stripe'

class PaymentAcquirer(models.Model):
    _inherit = 'payment.acquirer'

    def _stripe_call_proxy(self, api_method, args=None, payload=None, version=1):
        """ Calls the Stripe Connect proxy in order to follow Stripe Onboarding
            :param api_method: The Stripe Connect API method
            :param args: The optional Stripe Connect API method argument
            :param payload: The Stripe Connect API expected payload
            :param version: The Stripe Connect Proxy version
        """
        proxy_payload = {
            'jsonrpc': '2.0',
            'method': 'call',
            'params': {'payload': payload},
            'id': uuid.uuid4().hex,
        }
        endpoint = self.env['ir.config_parameter'].sudo().get_param('payment_stripe.iap_endpoint', DEFAULT_IAP_ENDPOINT)
        base_url = '%s/%s/' % (endpoint, version)
        try:
            response = requests.post(url=base_url + api_method, json=proxy_payload, timeout=60)
            if response.status_code != 200:
                _logger.exception("unable to reach endpoint at %s, status_code: %s", response.status_code)
                raise Exception(_("Proxy error : %s, reason : %s.", response.status_code, response.reason))
            response_json = response.json()
            if 'error' in response_json:
                _logger.exception("unable to reach endpoint at %s, exception: %s", base_url + api_method, response_json['data']['debug'])
                raise Exception(_("Proxy error."))
            if 'error' in response_json['result'] and response_json['result']['error_code'] != 760:  # error_code = 760 : Proxy Disabled
                _logger.exception("Error during proxy call at %s, error_code: %s, error: %s", base_url + api_method,
                                  response_json['result']['error_code'], response_json['result']['error'])
                raise Exception(_("Stripe connection error."))
        except Exception as e:
            raise UserError(_("An unexpected error happened while connecting to Stripe :\n\n%s\n\nPlease retry or create your Stripe account manually.", e.args[0]))
        return response_json['result']

    def _stripe_onboarding_account(self, account_id=None):
        self.ensure_one()
        if self.provider != 'stripe':
            raise NotImplementedError(_('This method can only be used on Stripe provider'))

        if not account_id:
            account = self._stripe_call_proxy('accounts', payload={'type': 'standard'})
            if account.get('error_code') == 760:
                return
            if not account.get('id'):
                raise UserError(_("An unexpected error happened while connecting to Stripe. Please retry or create your Stripe account manually."))
            account_id = account.get('id')
        account_links = self._stripe_call_proxy('account_links', payload={
            'account': account_id,
            'return_url': self.env.company.get_base_url() + '/payment/stripe/onboarding/return',
            'refresh_url': self.env.company.get_base_url() + '/payment/stripe/onboarding/refresh/' + account_id,
            'type': 'account_onboarding',
        })
        if account_links.get('error_code') == 760:
            return
        if not account_links.get('url'):
            raise UserError(_("An unexpected error happened while connecting to Stripe. Please retry or create your Stripe account manually."))

        return account_links.get('url')

    def action_stripe_onboarding_account(self):
        stripe_onboarding_url = self._stripe_onboarding_account()
        if not stripe_onboarding_url:
            raise UserError(_("Unable to create a Stripe Account directly from your instance for the moment. Please create one from Stripe Website"))
        return {
            'type': 'ir.actions.act_url',
            'url': stripe_onboarding_url,
            'target': 'self',
        }
