# coding: utf-8

import json
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
    # Standard Adyen fields
    o_adyen_api_key = fields.Char('API Key')
    o_adyen_merchant_account = fields.Char('Merchant Account')
    o_adyen_origin_keys = fields.Char('Origin Keys', help='Origin keys to instanciate Adyen DropIn instances stored in JSON; these are generated on the fly.', default="{}", readonly=True)
    # Odoo proxy values (not used yet)
    o_adyen_account_id = fields.Many2one('adyen.account', related='company_id.adyen_account_id')
    o_adyen_account_holder_code = fields.Char('Odoo Sub-merchant ID', related='o_adyen_account_id.account_holder_code')

    @api.model
    def _adyen_get_partner_reference(self, partner):
        """Generate a partner reference for Adyen (ShopperReference).

        :param partner: partner for which the reference must be generated
        :type partner: odoo.models.BaseModel (res.partner)
        :return: unique reference for the partner
        :rtype: String
        """        
        return f'ODOO_PARTNER_{partner.id}'

    def _adyen_proxy_request(self, url, data=None, method='POST', version=52):
        """Send a request to Adyen.

        TODO: switch Adyen for the Odoo proxy

        :param url: URL endpoint (no leading or trailing /)
        :type url: string
        :param data: json payload to submit, defaults to False
        :type data: dict, optional
        :param method: HTTP method for the request, defaults to 'POST'
        :type method: str, optional
        :param version: version of the specific API to contact, defaults to 52 (but may vary for each API)
        :type version: int, optional
        :raises ValidationError: when the request returns an error
        :return: response from the Adyen API
        :rtype: dict
        """        
        self.ensure_one()
        url = '/'.join([self._get_adyen_api_url(), 'v%s' %version, url])
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

    def _o_adyen_get_dropin_configuration(self, partner_id):
        """Generate the configuration for a DropIn instance.

        This method will fetch the payment methods configuration based on the partner's country, an
        origin key for the current domain and some other configuration keys for the DropIn instance
        that will be generated in the frontend.

        :param partner_id: id of the partner who will pay the transaction
        :type partner_id: int
        :return: configuration for the DropIn instance
        :rtype: dict
        """        
        self.ensure_one()
        partner = self.env['res.partner'].sudo().browse(partner_id)
        params = {
            'merchantAccount': self.o_adyen_merchant_account,
            'channel': 'Web',
            'countryCode': partner.country_id.code.lower(),
        }
        res = self._adyen_proxy_request('paymentMethods', params)
        return {
            'paymentMethodsResponse': res,
            'environment': 'live' if self.state == 'enable' else 'test',
            'originKey': self._o_adyen_get_origin_key(self.get_base_url()),
            'showPayButton': False,
        }

    def _o_adyen_get_origin_key(self, origin):
        """Get the originKey required to instanciate the Adyen DropIn iframe.

        If the originKey is already stored on the acquirer, return it; otherwise
        contact the Adyen API to get an origin key for the current domain (and store
        it for future usage).

        :param origin: the origin for which the origin key is requested
        :type origin: string
        :return: the originKey for the specified domain
        :rtype: string
        """        
        """Generate an origin key for the specified origin through the Adyen API."""
        try:
            current_keys = json.loads(self.o_adyen_origin_keys)
        except json.decoder.JSONDecodeError:
            # cannot be loaded, probably because the field was modified and is no-longer valid JSON
            # we start with a new set of keys that'll replace the faulty one
            current_keys = {}
        if origin in current_keys:
            return current_keys[origin]
        params = {
            'originDomains': [origin]
        }
        response = self._adyen_proxy_request('originKeys', version=1, data = params)
        new_key = response.get('originKeys', {}).get(origin)
        current_keys[origin] = new_key
        self.sudo().o_adyen_origin_keys = json.dumps(current_keys)
        _logger.info('generated new origin key for adyen provider #%s for domain %s, saved', self.id, origin)
        return new_key

    def _odoo_by_adyen_get_payment_details(self, adyen_data, tx_reference, **kwargs):
        """Obtain the payment details from the Adyen platform.

        This is necessary for 3DS authentication and is requested by the frontend DropIn instance.

        :param adyen_data: payment data from the frontend
        :type adyen_data: dict
        :param tx_reference: reference for the payment being handled
        :type tx_reference: string
        :return: the response from the Adyen platform
        :rtype: dict
        """        
        self.ensure_one()
        tx = self.env['payment.transaction'].sudo().search([('reference', '=', tx_reference)])
        res = self._adyen_proxy_request('payments/details', adyen_data)
        tx._o_adyen_feedback(res)
        return res

    def _odoo_by_adyen_process_payment(self, adyen_data, tx_reference, tx_signature, **kwargs):
        """Process payment data coming from the frontend and submit them to Adyen.

        :param adyen_data: payment data coming from the frontend
        :type adyen_data: dict
        :param tx_reference: reference of the transaction that will be submitted
        :type tx_reference: string
        :param tx_signature: cryptographic signature added to ensure the transaction was not modified
            during its transit through the frontend (see `adyen_by_odoo_form_generate_values`)
        :type tx_signature: string
        :raises ValidationError: if the signature does not match the transaction's values
        :return: the response from the Adyen API
        :rtype: dict
        """        
        self.ensure_one()
        # first we check the signature to ensure the transaction was not modified in the frontend
        tx = self.env['payment.transaction'].sudo().search([('reference', '=', tx_reference)])
        check_payload = f'{tx.amount}|{tx.partner_id.id}|{tx.reference}|{self.id}'
        db_secret = self.env['ir.config_parameter'].sudo().get_param('database.secret')
        sign_check = hmac.new(db_secret.encode(), check_payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sign_check, tx_signature):
            raise ValidationError('incorrect signature data')

        # signature ok, send the transaction to the Adyen API
        params = tx._o_adyen_get_payment_payload(online=True)
        params.update({
            'paymentMethod': adyen_data['paymentMethod'],
            'browserInfo': adyen_data['browserInfo'],
            'shopperIP': request.httprequest.remote_addr,
        })
        # if specified on the transaction, ask Adyen to tokenize the payment method
        if not self.env.user._is_public() and tx.type == 'form_save':
            params.update({
                'recurringProcessingModel': 'Subscription',
                'storePaymentMethod': True,
            })
        res = self._adyen_proxy_request('payments', params)
        tx._o_adyen_feedback(res)
        return res

    @api.model
    def _odoo_by_adyen_to_minor_units(self, amount, currency):
        """Convert an amount to its minor units representation (e.g. 4,32€ => 432)

        :param amount: the amount to convert
        :type amount: float
        :param currency: the currency record for the amount
        :type currency: BaseModel<res.currency>
        :return: the amount in minor units
        :rtype: integer
        """        
        return int(amount * 10 ** currency.decimal_places)

    def adyen_by_odoo_form_generate_values(self, values):
        """Add a cryptographic signature to check the authenticity of a transactionduring client-server interactions.

        :param values: form transaction values
        :type values: dict
        :return: transaction values updated with a signature key based on its content (amount|partner_id|reference)
        :rtype: dict
        """
        payload = f"{values['amount']}|{values['partner_id']}|{values['reference']}|{self.id}"
        db_secret = self.env['ir.config_parameter'].sudo().get_param('database.secret')
        values['signature'] = hmac.new(db_secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
        return values

    @api.model
    def _get_adyen_api_url(self):
        # TODO: prod URLs
        return 'https://checkout-test.adyen.com/'

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
        """Handle feedback from an Adyen payment processing call.

        :param data: the data sent by Adyen
        :type data: dict
        :return: True if the transaction was successful (done or pending), False otherwise
        :rtype: Boolean
        """        
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
        """Perform a transaction with Adyen.

        :return: True if the transaction was successful (done or pending), False otherwise
        :rtype: Boolean
        """        
        self.ensure_one()
        params = self._o_adyen_get_payment_payload(online=False)
        params.update({
            'paymentMethod': {
                'recurringDetailReference': self.payment_token_id.acquirer_ref,
            },
            'shopperInteraction': 'ContAuth',
            'recurringProccessingModel': 'Subscription',
        })

        res = self.acquirer_id._adyen_proxy_request('payments', params)
        return self._o_adyen_feedback(res)

    def _o_adyen_get_payment_payload(self, online=True):
        """Generate a JSON serializable representation of the transaction for the Adyen API.

        Note that this representation still requires payment method information.

        :param online: Whether the customer is present (checkout), defaults to True
        :type online: bool, optional
        :return: JSON serializable representation of the transaction
        :rtype: dict
        """ 
        base_url = self.acquirer_id.get_base_url()       
        values = {
            'merchantAccount': self.acquirer_id.o_adyen_merchant_account,
            'amount': {
                'value': self.acquirer_id._odoo_by_adyen_to_minor_units(self.amount, self.currency_id),
                'currency': self.currency_id.name,
            },
            "additionalData": {
            },
            "channel": "web",
            'shopperInteraction': 'Ecommerce',
            'origin': base_url,
            'reference': self.reference,
            'returnUrl': urls.url_join(base_url, AdyenByOdooController._return_url),
            'shopperReference': self.acquirer_id._adyen_get_partner_reference(self.partner_id),
        }
        if online:
            values["additionalData"]["allow3DS2"] = True
        else:
            values["additionalData"]["executeThreeD"] = False
        return values
class PaymentTokenAdyenByOdoo(models.Model):
    _inherit = 'payment.token'

    o_adyen_shopper_reference = fields.Char()
