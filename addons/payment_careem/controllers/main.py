# Part of Odoo. See LICENSE file for full copyright and licensing details.
import logging
import pprint

from odoo import http
from odoo.http import request

_logger = logging.getLogger(__name__)


class CareemPayController(http.Controller):
    _webhook_url = "/payment/careem/"
    _redirect_url = "/payment/careem/return"

    @http.route(_webhook_url, type='json', auth='public')
    def careem_webhook(self, notification_data=None, **data):
        """ Process the notification data sent by Careem on the webhook.
            :param notification_data: full invoice data
            :type notification_data: dict
            :param dict data: webhook data
        """
        # notification_data will only be there if called from website_payment_careem
        if not notification_data:
            tx_sudo = request.env['payment.transaction'].sudo()._get_tx_from_notification_data(
                'careem', data
            )
            notification_data = tx_sudo.provider_id._careem_fetch_invoice_data(tx_sudo)
        _logger.info("Notification received from Careem with data:\n%s", pprint.pformat(notification_data))
        request.env['payment.transaction'].sudo()._handle_notification_data('careem', notification_data)
        return ''

    # TODO: Remove before code-review? Maybe
    @http.route(_redirect_url, type='http', auth='public')
    def careem_return_from_checkout(self, **data):
        """ Process the notification data sent by Careem after redirection from checkout.
        :param dict data: payment status
        """
        tx_sudo = request.env['payment.transaction'].sudo()._get_tx_from_notification_data(
            'careem', data
        )
        notification_data = tx_sudo.provider_id._careem_fetch_invoice_data(tx_sudo)
        _logger.info("Notification received from Careem with data:\n%s", pprint.pformat(notification_data))
        request.env['payment.transaction'].sudo()._handle_notification_data('careem', notification_data)
        return request.redirect('/payment/status')

    @staticmethod
    def _get_partner_data(shipping_data, contact_data):
        return {
            'name': contact_data.get('name'),
            'email': contact_data.get('email'),
            'phone': contact_data.get('phone_number'),
            'city': shipping_data.get('locality'),
            'state': shipping_data.get('state'),
            'street': shipping_data.get('street_name'),
            'street2': shipping_data.get('house_number') + ', ' + shipping_data.get('house_name'),
            'country': shipping_data.get('country'),
            'zip': shipping_data.get('postcode')
        }
