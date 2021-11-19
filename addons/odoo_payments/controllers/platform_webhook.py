# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
from pprint import pformat

from odoo.http import Controller, request, route

from odoo.addons.odoo_payments.utils import odoo_payments_proxy_control

_logger = logging.getLogger(__name__)


class PlatformWebhookController(Controller):

    @odoo_payments_proxy_control
    @route('/odoo_payments/account_notification', type='json', auth='public', csrf=False)
    def odoo_payments_account_notification(self):
        """ Handle account notifications (coming from Adyen/Odoo)

        https://docs.adyen.com/api-explorer/#/NotificationService/v6/overview
        """
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
