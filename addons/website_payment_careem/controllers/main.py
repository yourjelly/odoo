# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import logging

from odoo import http
from odoo.http import request
from odoo.addons.website_sale.controllers.main import WebsiteSale
from odoo.addons.payment_careem.controllers.main import CareemPayController

_logger = logging.getLogger(__name__)


class CareemPaymentWebsiteSale(CareemPayController, WebsiteSale):

    @http.route()
    def careem_webhook(self, notification_data=None, **data):
        """ Get the partner details from CareemPay and update the sale order.

        :return: An empty string to acknowledge the notification
        :rtype: str
        """
        tx_sudo = request.env['payment.transaction'].sudo()._get_tx_from_notification_data('careem', data)
        notification_data = tx_sudo.provider_id._careem_fetch_invoice_data(tx_sudo)
        if 'location' in notification_data:
            if not hasattr(request, 'website'):
                request.website = request.env['website'].get_current_website()
            if not hasattr(request, 'lang'):
                request.lang = request.env['res.lang']._lang_get(request.default_lang())
            payment_address = self._get_partner_data(notification_data.get('location', {}),
                                                     notification_data.get('user_info', {}))
            self.process_express_checkout(billing_address=payment_address)
        return CareemPayController.careem_webhook(self, notification_data)

    def _include_country_and_state_in_address(self, address):
        """ Override of `website_sale`
        This function is used to include country_id and state_id in address. In case the name is provided.

        :param dict address: An address with country and state defined in ISO 3166.
        :return None:
        """
        original_country, original_state = address.get('country'), address.get('state')
        WebsiteSale._include_country_and_state_in_address(self, address)
        if not address.get('country') and not address.get('state'):
            country = request.env["res.country"].search([
                ('name', '=', address.pop('country', original_country)),
            ], limit=1)
            state = request.env["res.country.state"].search([
                ('name', '=', address.pop('state', original_state)),
            ], limit=1)
            if state and not country:
                country = state.country_id
            address.update(country=country, state=state)
