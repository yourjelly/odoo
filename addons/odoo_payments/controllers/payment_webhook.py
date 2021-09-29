# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
from pprint import pformat

from odoo import http
from odoo.http import request

from odoo.addons.odoo_payments.utils import odoo_payments_proxy_control

_logger = logging.getLogger(__name__)


class NotificationController(http.Controller):
    # Notifications Routes #
    # Proxy -> Customer databases

    @odoo_payments_proxy_control
    @http.route('/odoo_payments/transaction_notification', type='json', auth='public', csrf=False)
    def adyen_transaction_notification(self):
        """Handle payment notifications (from Adyen)

        https://docs.adyen.com/development-resources/webhooks/understand-notifications
        """
        data = request.jsonrequest
        _logger.debug('Transaction notification received: %s', pformat(data))
        for notification_item in data['notificationItems']:
            notification_data = notification_item['NotificationRequestItem']
            # NOTE ANVFE The account check is also done in the _handle_transaction_notification call
            # account = request.env['adyen.account'].sudo().search([('adyen_uuid', '=', data['adyen_uuid'])])
            # if not account:
            #     _logger.error('Received notification for non-existing account: %s', data['adyen_uuid'])
            #     return
            # TODO ANVFE also move handling of transaction notifications on the adyen.account model?
            # Since everything is linked to an adyen account, it'd be clearer to make all notifications
            # pass through this model/class.
            request.env['adyen.transaction'].sudo()._handle_transaction_notification(notification_data)
