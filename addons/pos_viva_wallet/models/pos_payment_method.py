# coding: utf-8
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import logging
import json
import base64
import time
import requests

from odoo import fields, models, api, _
from odoo.exceptions import UserError, AccessError
from odoo.http import request

_logger = logging.getLogger(__name__)
TIMEOUT = 10


class PosPaymentMethod(models.Model):
    _inherit = 'pos.payment.method'

    # Viva Wallet
    viva_wallet_merchant_id = fields.Char(string="Merchant ID", help='Used when connecting to Viva Wallet: https://developer.vivawallet.com/getting-started/find-your-account-credentials/merchant-id-and-api-key/', copy=False)
    viva_wallet_api_key = fields.Char(string="API Key", help='Used when connecting to Viva Wallet: https://developer.vivawallet.com/getting-started/find-your-account-credentials/merchant-id-and-api-key/', copy=False)
    viva_wallet_client_id = fields.Char(string="Client ID", help='Used when connecting to Viva Wallet: https://developer.vivawallet.com/getting-started/find-your-account-credentials/pos-apis-credentials/#find-your-pos-apis-credentials', copy=False)
    viva_wallet_client_secret = fields.Char(string="Client secret", copy=False)
    viva_wallet_terminal_id = fields.Char(string="Terminal ID", help='[Terminal ID of the Viva Wallet terminal], for example: 16002169', copy=False)
    viva_wallet_bearer_token = fields.Char(copy=False, groups='base.group_erp_manager', default='Bearer Token')
    viva_wallet_webhook_verification_key = fields.Char()
    viva_wallet_latest_response = fields.Json(copy=False, groups='base.group_erp_manager') # used to buffer the latest asynchronous notification from Adyen.
    viva_wallet_test_mode = fields.Boolean(string="Test mode", help="Run transactions in the test environment.")


    def viva_wallet_get_endpoint(self):
        if self.viva_wallet_test_mode:
            return 'https://demo-api.vivapayments.com'
        return 'https://accounts.vivapayments.com'

    def viva_wallet_webhook_get_endpoint(self):
        if self.viva_wallet_test_mode:
            return 'https://demo.vivapayments.com'
        return 'https://www.vivapayments.com'

    def _is_write_forbidden(self, fields):
        whitelisted_fields = {'viva_wallet_bearer_token', 'viva_wallet_webhook_verification_key', 'viva_wallet_latest_response'}
        return bool(fields - whitelisted_fields and self.open_session_ids)

    def viva_wallet_send_payment_request(self, data):
        if not self.env.user.has_group('point_of_sale.group_pos_user'):
            raise AccessError(_("Do not have access to fetch token from Viva Wallet"))

        headers = {
                'Authorization': 'Bearer ' + self.viva_wallet_bearer_token,
                'Content-Type': 'application/json'
            }
        try:
            resp = requests.post(self.viva_wallet_get_endpoint() + '/ecr/v1/transactions:sale', headers=headers, json=data, timeout=TIMEOUT)
        except requests.exceptions.RequestException:
            _logger.exception("Failed to call viva_wallet_bearer_token endpoint")
            return {'error': _("There are some issues between us and Viva Wallet, try again later. (viva_wallet_send_payment_request)")}

        if resp.text and json.loads(resp.text).get('detail') == 'Could not validate credentials':
            self._bearer_token()
            return self.viva_wallet_send_payment_request(data)
        elif resp.status_code == 200:
            return {'success': resp.status_code}
        else:
            return '' # error ?

    def viva_wallet_send_payment_cancel(self, data):
        if not self.env.user.has_group('point_of_sale.group_pos_user'):
            raise AccessError(_("Do not have access to fetch token from Viva Wallet"))

        headers = {
                'Authorization': 'Bearer ' + self.viva_wallet_bearer_token,
                'Content-Type': 'application/json'
            }
        session_id = data.get('sessionId')
        cash_register_id = data.get('cashRegisterId')
        endpoint = f'{self.viva_wallet_get_endpoint()}/ecr/v1/sessions/{session_id}?cashRegisterId={cash_register_id}'

        try:
            resp = requests.delete(endpoint, headers=headers, timeout=TIMEOUT)
        except requests.exceptions.RequestException:
            _logger.exception("Failed to call viva_wallet_bearer_token endpoint")
            return {'error': _("There are some issues between us and Viva Wallet, try again later. (viva_wallet_send_payment_cancel)")}

        if resp.text and json.loads(resp.text).get('detail') == 'Could not validate credentials':
            self._bearer_token()
            return self.viva_wallet_send_payment_request(data)
        elif resp.status_code == 200:
            return {'success': resp.status_code}
        else:
            return '' # error ?

    def retrieve_session_id(self, data_webhook):
        time.sleep(2)
        _logger.error('retrieve_session_id')
        headers = {
                'Authorization': 'Bearer ' + self.viva_wallet_bearer_token,
            }
        session_id, pos_session_id = data_webhook.get('MerchantTrns', '').split("/")
        try:
            endpoint = self.viva_wallet_get_endpoint() + '/ecr/v1/sessions/' + session_id
            resp = requests.get(endpoint, headers=headers, timeout=TIMEOUT)
        except requests.exceptions.RequestException:
            _logger.exception("Failed to call viva_wallet_bearer_token endpoint")
            raise UserError(_("There are some issues between us and Viva Wallet, try again later. (retrieve_session_id call)"))

        if resp.text and json.loads(resp.text).get('detail') == 'Could not validate credentials':
            self._bearer_token()
            self.retrieve_session_id(data_webhook)
        elif resp.status_code == 202:
            self.retrieve_session_id(data_webhook)
        elif resp.status_code == 200:
            data = json.loads(resp.text)
            if data.get('success'):
                # release event success
                data.update({'pos_session_id': pos_session_id})
                data.update({'data_webhook': data_webhook})
                self.viva_wallet_latest_response = data
                self.send_notification(data)
        else:
            raise UserError(_("There are some issues between us and Viva Wallet, try again later. (retrieve_session_id response)"))

    def send_notification(self, data):
        pos_session_sudo = request.env["pos.session"].sudo().browse(int(data.get('pos_session_id', False)))

        if pos_session_sudo:
            self.env['bus.bus']._sendone(pos_session_sudo._get_bus_channel_name(), 'VIVA_WALLET_LATEST_RESPONSE', pos_session_sudo.config_id.id)

    def _get_payment_terminal_selection(self):
        return super()._get_payment_terminal_selection() + [('viva_wallet', 'Viva Wallet')]

    def _bearer_token(self):
        if not self.env.user.has_group('point_of_sale.group_pos_user'):
            raise AccessError(_("Do not have access to fetch token from Viva Wallet"))

        data = {'grant_type': 'client_credentials'}
        auth = requests.auth.HTTPBasicAuth(self.viva_wallet_client_id, self.viva_wallet_client_secret)
        try:
            resp = requests.post(self.viva_wallet_get_endpoint() + '/connect/token', auth=auth, data=data, timeout=TIMEOUT)
        except requests.exceptions.RequestException:
            _logger.exception("Failed to call viva_wallet_bearer_token endpoint")
            raise UserError(_("There are some issues between us and Viva Wallet, try again later."))

        self.viva_wallet_bearer_token = json.loads(resp.text).get('access_token')

    def write(self, vals):
        viva_wallet_webhook_verification_key = self._get_verification_key(self.viva_wallet_merchant_id, self.viva_wallet_api_key)
        vals.update({'viva_wallet_webhook_verification_key': viva_wallet_webhook_verification_key})
        return super().write(vals)

    def create(self, vals):
        if vals['viva_wallet_merchant_id'] and vals['viva_wallet_api_key']:
            viva_wallet_webhook_verification_key = self._get_verification_key(self.viva_wallet_merchant_id, self.viva_wallet_api_key)
            vals['viva_wallet_webhook_verification_key'] = viva_wallet_webhook_verification_key
        return super().create(vals)

    def _get_verification_key(self, viva_wallet_merchant_id, viva_wallet_api_key):
        authentication = base64.b64encode(str(viva_wallet_merchant_id).encode() + b':' + str(viva_wallet_api_key).encode())
        headers = {
                'Authorization': 'Basic ' + authentication.decode()
            }
        try:
            resp = requests.get(self.viva_wallet_webhook_get_endpoint() + '/api/messages/config/token', headers=headers, timeout=TIMEOUT)
        except requests.exceptions.RequestException:
            _logger.exception("Failed to call https://demo.vivapayments.com/api/messages/config/token endpoint")
            raise UserError(_("There are some issues between us and Viva Wallet, try again later."))
        return json.loads(resp.text).get('Key')

    def get_latest_viva_wallet_status(self):
        self.ensure_one()
        latest_response = self.sudo().viva_wallet_latest_response
        return latest_response

    @api.constrains('use_payment_terminal')
    def _check_viva_wallet_credentials(self):
        for record in self:
            if (
                record.use_payment_terminal == 'viva_wallet'
                and not self.viva_wallet_merchant_id
                or not self.viva_wallet_api_key
                or not self.viva_wallet_client_id
                or not self.viva_wallet_client_secret
                or not self.viva_wallet_terminal_id
                ):
                raise UserError(_('It is essential to provide the merchant ID and API key for the use of viva wallet'))
