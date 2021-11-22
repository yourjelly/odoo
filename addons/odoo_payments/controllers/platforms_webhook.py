# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
from pprint import pformat

from odoo.http import Controller, request, route

from odoo.addons.odoo_payments.utils import odoo_payments_proxy_control

_logger = logging.getLogger(__name__)


class PlatformWebhookController(Controller):

    @odoo_payments_proxy_control
    @route('/odoo_payments/platforms_webhook', type='json', auth='public', csrf=False)
    def odoo_payments_platforms_webhook(self):
        """ Find the Adyen account and dispatch Platforms notifications to the appropriate handler.

        This endpoint is the webhook for Platforms notifications sent from Adyen. Each notification
        has an `evenType` which is used to dispatch the notification's content to the appropriate
        handler. See https://docs.adyen.com/api-explorer/#/NotificationService/v6/overview for an
        exhaustive list of existing event types. Note: only event types that are expected in the
        current implementation of the Adyen Platforms API are supported.

        :return: None
        """
        data = request.jsonrequest
        _logger.info("platforms notification received:\n%s", pformat(data))

        adyen_uuid = data['adyen_uuid']
        account_sudo = request.env['adyen.account'].sudo().search([('adyen_uuid', '=', adyen_uuid)])
        if not account_sudo:
            _logger.error("received notification for non-existing account: %s", adyen_uuid)
        else:
            event_type = data.get('eventType')
            content = data.get('content', {})
            if event_type == 'ACCOUNT_HOLDER_CREATED':
                account_sudo._handle_account_holder_created_notification()
            elif event_type == 'ACCOUNT_HOLDER_PAYOUT':
                account_sudo._handle_account_holder_payout_notification(content)
            elif event_type == 'ACCOUNT_HOLDER_STATUS_CHANGE':
                account_sudo._handle_account_holder_status_change_notification(content)
            elif event_type == 'ACCOUNT_HOLDER_VERIFICATION':
                account_sudo._handle_account_holder_verification_notification(content)
            elif event_type == 'ACCOUNT_UPDATED':
                account_sudo._handle_account_updated_notification(content)
            else:
                _logger.warning(
                    "discarded platforms notification with unknown event type: %s", event_type
                )
