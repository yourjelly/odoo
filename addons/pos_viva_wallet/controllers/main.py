# coding: utf-8
import logging
import json
from odoo import http, _
from odoo.http import request

_logger = logging.getLogger(__name__)


class PosVivaWalletController(http.Controller):
    @http.route('/pos_viva_wallet/notification', type='http', auth='none', csrf=False)
    def notification(self):
        _logger.info('notification received from Viva Wallet')

        host = ['demo.vivapayments.com', 'www.vivapayments.com', '8ddfbf9becae.ngrok.app']
        payment_method_sudo = request.env['pos.payment.method'].sudo().search([('use_payment_terminal', '=', 'viva_wallet')], limit=1)
        resp = {'Key': payment_method_sudo.viva_wallet_webhook_verification_key}

        if request.httprequest.method == 'POST' and payment_method_sudo:
            data = json.loads(request.httprequest.data)

            _logger.error(data)
            terminal_id = data.get('EventData', {}).get('TerminalId', '')
            data_webhook = data.get('EventData', {})
            if terminal_id:
                payment_method_sudo = request.env['pos.payment.method'].sudo().search([('viva_wallet_terminal_id', '=', terminal_id)], limit=1)

                payment_method_sudo.retrieve_session_id(data_webhook)
            else:
                _logger.error(_('received a message for a terminal not registered in Odoo: %s', terminal_id))
        elif request.httprequest.host in host:
            return json.dumps(resp)
        else:
            _logger.error(_('received a message for a pos payment provider not registered.'))
