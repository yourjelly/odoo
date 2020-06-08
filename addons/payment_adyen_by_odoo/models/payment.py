# coding: utf-8

import logging
import requests
import pprint
from requests.exceptions import HTTPError
from werkzeug import urls
import hmac
import hashlib

from odoo import api, fields, models, _
from odoo.tools.float_utils import float_round

from odoo.addons.payment.models.payment_acquirer import ValidationError
from odoo.addons.payment_stripe.controllers.main import StripeController

_logger = logging.getLogger(__name__)



class PaymentAcquirerAdyenOdoo(models.Model):
    _inherit = 'payment.acquirer'

    provider = fields.Selection(selection_add=[('adyen_by_odoo', 'Adyen (by Odoo)')])
    o_adyen_account_id = fields.Many2one('adyen.account', related='company_id.adyen_account_id')
    o_adyen_api_key = fields.Char('API Key')
    o_adyen_merchant_account = fields.Char('Merchant Account')

    def _adyen_proxy_request(self, url, data=False, method='POST'):
        self.ensure_one()
        url = '/'.join([self._get_adyen_api_url(), url])
        headers = {
            'X-API-Key': self.sudo().o_adyen_api_key,
            }
        resp = requests.request(method, url, json=data, headers=headers)
        print(url)
        print(headers)
        try:
            resp.raise_for_status()
        except HTTPError:
            _logger.error(resp.text)
            stripe_error = resp.json().get('error', {}).get('message', '')
            error_msg = " " + (_("Adyen gave us the following information about the problem: '%s'") % stripe_error)
            raise ValidationError(error_msg)
        return resp.json()

    def _o_adyen_get_payment_methods(self, **kwargs):
        self.ensure_one()
        params = {
            'merchantAccount': self.o_adyen_merchant_account,
            'amount': kwargs.get('amount', 0),
            'channel': 'Web',
            'countryCode': kwargs.get('countryCode', 'be'),
            'shopperLocale': kwargs.get('shopperLocale', 'fr'),
        }
        _logger.info('_o_adyen_get_payment_methods: Sending values to proxy, values:\n%s', pprint.pformat(params))

        res = self._adyen_proxy_request('paymentMethods', params)

        _logger.info('_o_adyen_get_payment_methods: Values received:\n%s', pprint.pformat(res))
        return res

    def _odoo_by_adyen_process_payment(self, adyen_data, acquirer_id, tx_reference, tx_signature, **kwargs):
        self.ensure_one()
        tx = self.env['payment.transaction'].sudo().search([('reference', '=', tx_reference)])
        check_payload = f'{tx.amount}|{tx.partner_id.id}|{tx.reference}|{self.id}'
        db_secret = self.env['ir.config_parameter'].sudo().get_param('database.secret')
        sign_check = hmac.new(db_secret.encode(), check_payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sign_check, tx_signature):
            raise ValidationError('incorrect signature data')
        params = {
            'merchantAccount': self.o_adyen_merchant_account,
            'amount': {
                'value': self._odoo_by_adyen_to_minor_units(tx.amount, tx.currency_id),
                'currency': tx.currency_id.name,
            },
            'paymentMethod': adyen_data['paymentMethod'],
            'reference': tx.reference,
            'returnUrl': tx.return_url
        }
        _logger.info('_o_adyen_get_payment_methods: Sending values to proxy, values:\n%s', pprint.pformat(params))

        res = self._adyen_proxy_request('payments', params)

        _logger.info('_o_adyen_get_payment_methods: Values received:\n%s', pprint.pformat(res))
        return res

    @api.model
    def _odoo_by_adyen_to_minor_units(self, amount, currency):
        return int(amount * 10 ** currency.decimal_places)

    def adyen_by_odoo_form_generate_values(self, values):
        """Add a cryptographic signature to check the authenticity of a transaction
        during back-and-forth between client and server."""
        payload = f"{values['amount']}|{values['partner_id']}|{values['reference']}|{self.id}"
        db_secret = self.env['ir.config_parameter'].sudo().get_param('database.secret')
        values['signature'] = hmac.new(db_secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
        return values

    @api.model
    def _get_adyen_api_url(self):
        return 'https://checkout-test.adyen.com/v52'

    @api.model
    def stripe_s2s_form_process(self, data):
        if 'card' in data and not data.get('card'):
            # coming back from a checkout payment and iDeal (or another non-card pm)
            # can't save the token if it's not a card
            # note that in the case of a s2s payment, 'card' wont be
            # in the data dict because we need to fetch it from the stripe server
            _logger.info('unable to save card info from Stripe since the payment was not done with a card')
            return self.env['payment.token']
        last4 = data.get('card', {}).get('last4')
        if not last4:
            # PM was created with a setup intent, need to get last4 digits through
            # yet another call -_-
            acquirer_id = self.env['payment.acquirer'].browse(int(data['acquirer_id']))
            pm = data.get('payment_method')
            res = acquirer_id._stripe_request('payment_methods/%s' % pm, data=False, method='GET')
            last4 = res.get('card', {}).get('last4', '****')

        payment_token = self.env['payment.token'].sudo().create({
            'acquirer_id': int(data['acquirer_id']),
            'partner_id': int(data['partner_id']),
            'stripe_payment_method': data.get('payment_method'),
            'name': 'XXXXXXXXXXXX%s' % last4,
            'acquirer_ref': data.get('customer')
        })
        return payment_token

    def _get_feature_support(self):
        """Get advanced feature support by provider.

        Each provider should add its technical in the corresponding
        key for the following features:
            * tokenize: support saving payment data in a payment.tokenize
                        object
        """
        res = super()._get_feature_support()
        res['tokenize'].append('adyen_by_odoo')
        return res
