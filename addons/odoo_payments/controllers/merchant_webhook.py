# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
from pprint import pformat

from odoo.http import Controller, request, route

from odoo.addons.odoo_payments.utils import odoo_payments_proxy_control

_logger = logging.getLogger(__name__)


class PlatformWebhookController(Controller):

    @odoo_payments_proxy_control
    @route('/odoo_payments/merchant_webhook', type='json', auth='public', csrf=False)
    def odoo_payments_merchant_webhook(self):
        """ Find the Adyen account and dispatch merchant notifications to the appropriate handler.

        This endpoint is the webhook for notifications sent from the merchant (odoo.com). Each
        notification has an `eventType` which is used to dispatch the notification's content to
        the appropriate handler.

        :return: None
        """
        data = request.jsonrequest
        _logger.info("merchant notification received:\n%s", pformat(data))

        adyen_uuid = data['adyen_uuid']
        account_sudo = request.env['adyen.account'].sudo().search([('adyen_uuid', '=', adyen_uuid)])
        if not account_sudo:
            _logger.error("received notification for non-existing account: %s", adyen_uuid)
        else:
            event_type = data.get('eventType')
            content = data.get('content', {})
            if event_type == 'MERCHANT_STATUS_CHANGE':
                account_sudo._handle_merchant_status_change_notification(content)
            else:
                _logger.warning(
                    "discarded merchant notification with unknown event type: %s", event_type
                )
