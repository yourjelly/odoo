# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
from pprint import pformat

from odoo import http
from odoo.http import request

from odoo.addons.odoo_payments.util import odoo_payments_proxy_control

_logger = logging.getLogger(__name__)


class OdooPaymentsController(http.Controller):

    @http.route('/odoo_payments/create_account', type='http', auth='user', website=True)
    def odoo_payments_create_account(self, creation_token):
        request.session['adyen_creation_token'] = creation_token
        return request.redirect('/web?#action=odoo_payments.adyen_account_action_create')

    @odoo_payments_proxy_control
    @http.route('/odoo_payments/account_notification', type='json', auth='public', csrf=False)
    def odoo_payments_notification(self):
        data = request.jsonrequest
        _logger.debug('Account notification received: %s', pformat(data))

        account_sudo = request.env['adyen.account'].sudo().search([
            ('adyen_uuid', '=', data['adyen_uuid'])])
        if not account_sudo:
            _logger.error('Received notification for non-existing account: %s', data['adyen_uuid'])
            return

        # TODO ANVFE specify a clear API to clearly inform the proxy whether
        # its notifications were correctly handled or not
        # At least for notifications coming from internal, aka ODOO_ACCOUNT_STATUS_CHANGE
        # should raise to the support user if it didn't work as expected...
        account_sudo.with_context(update_from_adyen=True)._handle_account_notification(data)

    @odoo_payments_proxy_control
    @http.route('/odoo_payments/transaction_notification', type='json', auth='public', csrf=False)
    def adyen_transaction_notification(self):
        data = request.jsonrequest
        _logger.debug('Transaction notification received: %s', pformat(data))

        # NOTE ANVFE The account check is also done in the _handle_transaction_notification call
        # account = request.env['adyen.account'].sudo().search([('adyen_uuid', '=', data['adyen_uuid'])])
        # if not account:
        #     _logger.error('Received notification for non-existing account: %s', data['adyen_uuid'])
        #     return

        request.env['adyen.transaction'].sudo()._handle_transaction_notification(data)
