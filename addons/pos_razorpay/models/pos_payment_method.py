# coding: utf-8
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import logging
import requests

from odoo.exceptions import UserError
from odoo import fields, models, api, _

_logger = logging.getLogger(__name__)
REQUEST_TIMEOUT = 30

class PosPaymentMethod(models.Model):
    _inherit = 'pos.payment.method'

    razorpay_tid = fields.Char(string='Razorpay Terminal ID', help="Terminal ID or Device ID \n ex: 70000123")
    allowed_payment_modes = fields.Selection(selection=[('all', 'All'), ('card', 'Card'), ('upi', 'UPI'), ('bharatqr', 'BHARATQR')], default='all', help="Choose allow payment mode: \n All/Card/UPI or QR")
    razorpay_mid = fields.Char(string="Razorpay Merchant ID")
    razorpay_merchant_key = fields.Char(string="Razorpay Merchant API Key", help="Merchant key \n ex: abcdefgh-0000-1a23-ab00-12a3b4cd5ef6")
    razorpay_test_mode = fields.Boolean(string="Razorpay Test Mode", default=False, help="Turn it on when in Test Mode")

    def _get_payment_terminal_selection(self):
        return super()._get_payment_terminal_selection() + [('razorpay', 'Razorpay')]

    def _call_razorpay(self, endpoint, payload=None):
        """ Make a request to Razorpay API.

        :param str endpoint: The endpoint to be reached by the request.
        :param dict payload: The payload of the request.
        :return The JSON-formatted content of the response.
        :rtype: dict
        """
        try:
            if self.razorpay_test_mode:
                api_url = 'https://demo.ezetap.com/api/3.0/p2padapter/'
            else:
                api_url = 'https://www.ezetap.com/api/3.0/p2padapter/'
            response = requests.post(api_url+endpoint, json=payload, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
        except (requests.exceptions.Timeout, requests.exceptions.RequestException) as error:
            _logger.warning("Cannot connect with Razorpay. Error: %s", error)
            return {'error': '%s' % error}
        res_json = response.json()
        return res_json

    def razorpay_make_payment_request(self, data):
        body = self._razorpay_get_payment_request_body()
        body.update({
            'amount': data.get('amount'),
            'externalRefNumber': data.get('referenceId')
        })
        response = self._call_razorpay(endpoint="pay", payload=body)
        if response.get('success') and not response.get('errorCode'):
            return {
                'success': response.get('success') == True,
                'p2pRequestId': '%s' % response.get('p2pRequestId')
            }
        default_error_msg = _('Razorpay payment request expected errorCode not found in the response')
        error = response.get('errorMessage') or default_error_msg
        return {'error': '%s' % error}

    def razorpay_fetch_payment_status(self, data):
        body = self._razorpay_get_payment_status_request_body()
        body['origP2pRequestId'] = data.get('p2pRequestId')
        response = self._call_razorpay(endpoint="status", payload=body)
        if response.get('success') and not response.get('errorCode'):
            _logger.info(response.get('message'))
            payment_status = response.get('status')
            if payment_status == 'AUTHORIZED' and response.get('messageCode') == 'P2P_DEVICE_TXN_DONE':
                return {
                    'status': response.get('status'),
                    'authCode': response.get('authCode'),
                    'cardLastFourDigit': response.get('cardLastFourDigit'),
                    'externalRefNumber': response.get('externalRefNumber'),
                    'txnId': response.get('txnId'),
                    'paymentMode': response.get('paymentMode'),
                    'paymentCardType': response.get('paymentCardType'),
                    'paymentCardBrand': response.get('paymentCardBrand'),
                    'acquirerCode': response.get('acquirerCode'),
                    'settlementStatus': response.get('settlementStatus'),
                    'createdTime': response.get('createdTime'),
                    'userAgreement': response.get('userAgreement')
                }
            elif payment_status == 'FAILED' or response.get('messageCode') == 'P2P_DEVICE_CANCELED':
                return {'error': "%s" % response.get('message', _('razorpay transaction failed'))}
            else:
                return {}
        default_error_msg = _('Razorpay payment status request expected errorCode not found in the response')
        error = response.get('errorMessage') or default_error_msg
        return {'error': '%s' % error}

    def razorpay_cancel_payment_request(self, data):
        body = self._razorpay_get_payment_request_body()
        body.pop('mode')
        body['origP2pRequestId'] = data.get('p2pRequestId')
        response = self._call_razorpay(endpoint="cancel", payload=body)
        if response.get('success') and not response.get('errorCode'):
            return {'error': "%s" % _('razorpay transaction canceled successfully')}
        default_error_msg = _('Razorpay payment cancel request expected errorCode not found in the response')
        error = response.get('errorMessage') or default_error_msg
        return {'error': '%s' % error}

    def _razorpay_get_payment_request_body(self):
        additional_parameters = {
            'pushTo': {
                "deviceId": self.razorpay_tid + "|ezetap_android",
            },
            'mode': self.allowed_payment_modes.upper()
        }
        additional_parameters.update(self._razorpay_get_payment_status_request_body())
        return additional_parameters

    def _razorpay_get_payment_status_request_body(self):
        return {
            'username': self.razorpay_mid,
            'appKey': self.razorpay_merchant_key
        }

    @api.constrains('use_payment_terminal')
    def _check_razorpay_terminal(self):
        for record in self:
            if record.use_payment_terminal == 'razorpay' and record.company_id.currency_id.name != 'INR':
                raise UserError(_('This Payment Terminal is only valid for INR Currency'))
