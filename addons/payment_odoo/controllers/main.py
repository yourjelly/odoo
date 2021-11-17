# Part of Odoo. See LICENSE file for full copyright and licensing details.

import json
import logging
import pprint

from odoo import http
from odoo.http import request

from odoo.addons.payment import utils as payment_utils
from odoo.addons.payment_odoo.const import CURRENCY_DECIMALS

_logger = logging.getLogger(__name__)


class OdooController(http.Controller):
    _return_url = '/payment/odoo/return'
    _webhook_url = '/payment/odoo/webhook'

    @http.route(_return_url, type='http', methods=['GET'], auth='public')
    def odoo_return_from_redirect(self, reference, access_token):
        """ Set the transaction as 'pending' and redirect the user to the status page.

        The user is redirected to this route by Adyen after making a payment. The reference and
        access token are appended to the return URL before passing it to Adyen.

        :param str reference: The reference of the transaction
        :param str access_token: The access token used to verify the provided values
        """
        tx_sudo = request.env['payment.transaction'].sudo()._get_tx_from_feedback_data(
            'odoo', {'merchantReference': reference}
        )
        if payment_utils.check_access_token(
            access_token, tx_sudo.amount, tx_sudo.currency_id.name, tx_sudo.reference
        ):  # Check the access token to prevent setting any transaction as 'pending'.
            tx_sudo._set_pending()

        return request.redirect('/payment/status')

    @http.route(_webhook_url, type='json', auth='public')
    def odoo_webhook(self):
        """ Process the data sent by Adyen to the webhook based on the event code.

        See https://docs.adyen.com/development-resources/webhooks/understand-notifications for the
        exhaustive list of event codes.

        :return: None
        """
        # TODO use same code as payment_adyen
        # Payload data represent a single notification's data. Because two notifications of a same
        # batch can be related to different sub-merchants, the proxy splits the batches and send
        # individual notifications one by one to this endpoint.
        notification_data = json.loads(request.httprequest.data)
        for notification_item in notification_data['notificationItems']:
            notification_data = notification_item['NotificationRequestItem']
            tx_sudo = request.env['payment.transaction'].sudo()._get_tx_from_feedback_data(
                'odoo', notification_data
            )

            # Check that the notification originates from the transaction. Don't check the access
            # token REFUND notifications. The signature will be the one of the original transaction.
            event_code = notification_data['eventCode']
            access_token = notification_data.get('additionalData', {}).get('metadata.access_token')
            if event_code != 'REFUND' and not self._verify_notification_access_token(
                access_token, tx_sudo
            ):
                return

            _logger.info("notification received:\n%s", pprint.pformat(notification_data))
            if notification_data['success'] != 'true' and event_code != 'REFUND':
                return  # Don't handle failed events

            request.env['adyen.transaction'].sudo()._handle_payment_notification(
                notification_data, tx_sudo
            )

            success = notification_data['success'] == 'true'
            # Reshape the notification data for parsing
            if event_code == 'AUTHORISATION' and success:
                # By default, Adyen automatically captures transactions
                # authorisation = Done for tx, unless we explicitly request manual capture.
                notification_data['resultCode'] = 'Authorised'
            elif event_code == 'CANCELLATION' and success:
                notification_data['resultCode'] = 'Cancelled'
            elif event_code in ['NOTIFICATION_OF_CHARGEBACK', 'CHARGEBACK']:
                notification_data['resultCode'] = 'Chargeback'
            elif event_code == 'REFUND':
                # notification_data['resultCode'] = 'Refund'
                notification_data['resultCode'] = 'Authorised' if success else 'Error'
            else:
                return  # Don't handle unsupported event codes or failed events

            # Handle the notification data as a regular feedback
            request.env['payment.transaction'].sudo()._handle_feedback_data(
                'odoo', notification_data
            )
        return '[accepted]'

    def _verify_notification_access_token(self, received_access_token, tx):
        """ Check that the signature computed from the transaction values matches the received one.

        :param str received_access_token: The access token sent with the notification
        :param recordset tx: The transaction of the notification, as a `payment.transaction` record

        :return: Whether the access token matches
        :rtype: str
        """
        if not received_access_token:
            _logger.warning("ignored notification with missing access token")
            return False

        if not payment_utils.check_access_token(
            received_access_token, self.amount, tx.currency_id.name, tx.reference
        ):
            _logger.warning("ignored notification with invalid access token")
            return False

        return True
