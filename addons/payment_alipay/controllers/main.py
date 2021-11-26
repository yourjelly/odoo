# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
import pprint
from werkzeug.exceptions import Forbidden
import requests
from odoo.tools import consteq

from odoo import _, http
from odoo.exceptions import ValidationError
from odoo.http import request

_logger = logging.getLogger(__name__)


class AlipayController(http.Controller):
    _return_url = '/payment/alipay/return'
    _webhook_url = '/payment/alipay/webhook'

    @http.route(_return_url, type='http', auth="public", methods=['GET'])
    def alipay_return_from_redirect(self, **data):
        """ Process the data returned by Alipay after redirection.

        :param dict data: Feedback data. May include custom params sent to Alipay in the request to
                        allow matching the transaction when redirected here.
        """
        _logger.info("received Alipay return data:\n%s", pprint.pformat(data))
        request.env['payment.transaction'].sudo()._handle_feedback_data('alipay', data)
        return request.redirect('/payment/status')

    @http.route(_webhook_url, type='http', auth='public', methods=['POST'], csrf=False)
    def alipay_webhook(self, **post):
        """ Process the data sent by Alipay to the webhook.

        :param dict data: Feedback data. May include custom params sent to Alipay in the request to
                        allow matching the transaction when redirected here.
        :return: The 'success' string to acknowledge the notification
        :rtype: str
        """
        _logger.info("received Alipay notification data:\n%s", pprint.pformat(post))

        #self._alipay_validate_notification(**post)
        self._verify_webhook_signature(**post)

        try:
            # Handle the feedback data crafted with Alipay API objects as a regular feedback
            request.env['payment.transaction'].sudo()._handle_feedback_data('alipay', post)
        except ValidationError: # Acknowledge the notification to avoid getting spammed
            _logger.exception("unable to handle the event data; skipping to acknowledge")
        return 'success'  # Return 'success' to stop receiving notifications for this tx

    def _alipay_validate_notification(self, **post):
        """ Check that the notification was sent by Alipay
        See https://global.alipay.com/docs/ac/wap/async

        :return: None
        :raise: HTTP 403 Forbidden if the signatures don't match
        """
        tx_sudo = request.env['payment.transaction'].sudo()._get_tx_from_feedback_data(
            'alipay', post
        )
        if not tx_sudo:
            raise ValidationError(
                "Alipay: " + _(
                    "Received notification data with unknown reference:\n%s", pprint.pformat(post)
                )
            )

        # Ensure that the notification was sent by Alipay
        # See https://global.alipay.com/docs/ac/wap/async
        acquirer_sudo = tx_sudo.acquirer_id
        val = {
            'service': 'notify_verify',
            'partner': acquirer_sudo.alipay_merchant_partner_id,
            'notify_id': post['notify_id']
        }
        response = requests.post(acquirer_sudo._alipay_get_api_url(), val, timeout=60)
        response.raise_for_status()
        if response.text != 'true':
            raise Forbidden(description=
                "Alipay: " + _(
                    "Received notification data not acknowledged by Alipay:\n%s",
                    pprint.pformat(post)
                )
            )

    def _verify_webhook_signature(self, **values):
        """ Check that the signature computed from the feedback matches the received one.
        The cryptographic function is MD5.

        :param dict values: The values used to generate the signature
        :return: Whether the signatures match
        :rtype: str
        """
        #Ensure that the notification is sent by Alipay before you start verify the content of the notification
        self._alipay_validate_notification(**values)

        received_signature = values.get('sign')

        if not received_signature:
            _logger.warning("Push response ignored due to missing signature")
            return False

        # Retrieve the acquirer based on the tx reference included in the return url
        tx_sudo = request.env['payment.transaction'].sudo()._get_tx_from_feedback_data(
            'buckaroo', values
        )

        # Compute signature
        expected_signature = tx_sudo.acquirer_id._alipay_build_sign(values)

        print('expected signature', expected_signature)
        print('received signature', received_signature)

        # Compare signatures
        if not consteq(received_signature, expected_signature):
            _logger.warning("Push response ignored due to invalid shasign")
            return False
        else:
            return True

