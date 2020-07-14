# coding: utf-8

import logging
import requests
import pprint
from requests.exceptions import HTTPError
from werkzeug import urls
import hmac
import hashlib
from uuid import uuid4

from odoo import api, fields, models, _
from odoo.http import request
from odoo.tools.float_utils import float_round

from odoo.addons.payment.models.payment_acquirer import ValidationError
from odoo.addons.payment_adyen_by_odoo.controllers.main import AdyenByOdooController

_logger = logging.getLogger(__name__)



class PaymentAcquirerAdyenOdoo(models.Model):
    _inherit = 'payment.acquirer'

    provider = fields.Selection(selection_add=[('adyen_by_odoo', 'Adyen (by Odoo)')])
    o_adyen_account_id = fields.Many2one('adyen.account', related='company_id.adyen_account_id')
    o_adyen_api_key = fields.Char('API Key')
    o_adyen_merchant_account = fields.Char('Merchant Account')

    @api.model
    def _adyen_get_partner_reference(self, partner):
        """Generate a partner reference for Adyen (ShopperReference).

        :param partner: partner for which the reference must be generated
        :type partner: odoo.models.BaseModel (res.partner)
        :return: unique reference for the partner
        :rtype: String
        """        
        return f'ODOO_PARTNER_{partner.id}'

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
            'countryCode': kwargs.get('countryCode', 'us'),
        }
        _logger.info('_o_adyen_get_payment_methods: Sending values to proxy, values:\n%s', pprint.pformat(params))

        res = self._adyen_proxy_request('paymentMethods', params)

        _logger.info('_o_adyen_get_payment_methods: Values received:\n%s', pprint.pformat(res))
        return res

    def _odoo_by_adyen_get_payment_details(self, adyen_data, tx_reference, **kwargs):
        self.ensure_one()
        _logger.info('_odoo_by_adyen_get_payment_details: Sending values to proxy, values:\n%s', pprint.pformat(adyen_data))
        tx = self.env['payment.transaction'].sudo().search([('reference', '=', tx_reference)])
        res = self._adyen_proxy_request('payments/details', adyen_data)
        tx._o_adyen_feedback(res)
        _logger.info('_odoo_by_adyen_get_payment_details: Values received:\n%s', pprint.pformat(res))
        return res

    def _odoo_by_adyen_process_payment(self, adyen_data, acquirer_id, tx_reference, tx_signature, **kwargs):
        self.ensure_one()
        base_url = self.get_base_url()
        tx = self.env['payment.transaction'].sudo().search([('reference', '=', tx_reference)])
        check_payload = f'{tx.amount}|{tx.partner_id.id}|{tx.reference}|{self.id}'
        db_secret = self.env['ir.config_parameter'].sudo().get_param('database.secret')
        sign_check = hmac.new(db_secret.encode(), check_payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sign_check, tx_signature):
            raise ValidationError('incorrect signature data')
        params = tx._o_adyen_get_payment_payload(online=True)
        params.update({
            'paymentMethod': adyen_data['paymentMethod'],
            'browserInfo': adyen_data['browserInfo'],
            'shopperIP': request.httprequest.remote_addr,
        })
        if not self.env.user._is_public():
            params.update({
                'recurringProcessingModel': 'Subscription',
                'storePaymentMethod': True,
            })
        _logger.info('_o_adyen_get_payment_methods: Sending values to proxy, values:\n%s', pprint.pformat(params))

        res = self._adyen_proxy_request('payments', params)
        _logger.info('_o_adyen_get_payment_methods: Values received:\n%s', pprint.pformat(res))
        tx._o_adyen_feedback(res)
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

    def _adyen_form_validate(self, data):
        print(data)

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


class PaymentTransactionAdyenOdoo(models.Model):
    _inherit = 'payment.transaction'

    o_adyen_payment_data = fields.Char()
    o_adyen_payment_session_id = fields.Char()
    # store the 'MD' parameters of the payment API
    # couldn't resolve myself to use a variable name I don't understand

    def _o_adyen_feedback(self, data):
        self.ensure_one()
        if data.get('action', {}).get('data', {}).get('MD'):
            self.o_adyen_payment_session_id = data['action']['data']['MD']
        if data.get('paymentData'):
            self.o_adyen_payment_data = data['paymentData']
        if self.state not in ("draft", "pending"):
            _logger.info('Adyen by Odoo: trying to validate an already validated tx (ref %s)', self.reference)
            return True

        resultCode = data.get('resultCode')
        if not resultCode or resultCode in ('IdentifyShopper', 'ChallengeShopper', 'RedirectShopper'):
            # nothing to do (usually 3DS2 challenge in progress), remain in draft
            return False
        pspReference = data.get('pspReference')
        vals = {
            "date": fields.datetime.now(),
            "acquirer_reference": pspReference,
        }
        if resultCode == 'Authorised':
            self.write(vals)
            self._set_transaction_done()
            self.execute_callback()
            if data.get('additionalData', {}).get('recurring.recurringDetailReference'):
                token = self.env['payment.token'].create({
                        'name': ''.join(['******', data.get('additionalData', {}).get('cardSummary', 'XXXX')]),
                        'partner_id': self.partner_id.id,
                        'acquirer_id': self.acquirer_id.id,
                        'acquirer_ref': data['additionalData']['recurring.recurringDetailReference'],
                        'o_adyen_shopper_reference': data['additionalData']['recurring.shopperReference'],
                        'verified': True,
                })
                self.payment_token_id = token
            return True
        if resultCode in ('Pending', 'Received'):
            self.write(vals)
            self._set_transaction_pending()
            return True
        if resultCode == 'Cancelled':
            self._set_transaction_cancel()
            return False
        else:
            error = data.get("refusalReason")
            self._set_transaction_error(error)
            return False

    def adyen_by_odoo_s2s_do_transaction(self, **kwargs):
        self.ensure_one()
        params = self._o_adyen_get_payment_payload(online=False)
        params.update({
            'paymentMethod': {
                'recurringDetailReference': self.payment_token_id.acquirer_ref,
            },
            'shopperInteraction': 'ContAuth',
            'recurringProccessingModel': 'Subscription',
        })

        _logger.info('adyen_by_odoo_s2s_do_transaction: Sending values to proxy, values:\n%s', pprint.pformat(params))
        res = self.acquirer_id._adyen_proxy_request('payments', params)
        _logger.info('adyen_by_odoo_s2s_do_transaction: Values received:\n%s', pprint.pformat(res))
        self._o_adyen_feedback(res)
        return res

    def _o_adyen_get_payment_payload(self, online=True):
        """Generate a JSON serializable representation of the transaction for the Adyen API.

        Note that this representation still requires payment method information.

        :param online: Whether the customer is present (checkout), defaults to True
        :type online: bool, optional
        :return: JSON serializable representation of the transaction
        :rtype: dict
        """ 
        base_url = self.acquirer_id.get_base_url()       
        return {
            'merchantAccount': self.acquirer_id.o_adyen_merchant_account,
            'amount': {
                'value': self.acquirer_id._odoo_by_adyen_to_minor_units(self.amount, self.currency_id),
                'currency': self.currency_id.name,
            },
            "additionalData": {
                "allow3DS2": online,
            },
            "channel": "web",
            'shopperInteraction': 'Ecommerce',
            'origin': base_url,
            'reference': self.reference,
            'returnUrl': urls.url_join(base_url, AdyenByOdooController._return_url),
            'shopperReference': self.acquirer_id._adyen_get_partner_reference(self.partner_id),
        }
class PaymentTokenAdyenByOdoo(models.Model):
    _inherit = 'payment.token'

    o_adyen_shopper_reference = fields.Char()
