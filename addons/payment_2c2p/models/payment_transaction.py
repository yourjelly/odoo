# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
import pprint

from werkzeug import urls

from odoo import _, models
from odoo.exceptions import ValidationError

from odoo.addons.payment_2c2p import const


_logger = logging.getLogger(__name__)


class PaymentTransaction(models.Model):
    _inherit = "payment.transaction"

    def _get_specific_rendering_values(self, processing_values):
        """ Override of `payment` to return 2C2P-specific rendering values.
        Note: self.ensure_one() from `_get_processing_values`
        :param dict processing_values: The generic and specific processing values of the transaction
        :return: The dict of provider-specific processing values.
        :rtype: dict
        """
        res = super()._get_specific_rendering_values(processing_values)
        if self.provider_code != '2c2p':
            return res

        # Initiate the payment and retrieve the invoice data.
        payload = self._tctp_prepare_invoice_request_payload()
        _logger.info("Sending invoice request for link creation:\n%s", pprint.pformat(payload))
        invoice_data = self.provider_id._tctp_make_request(payload)
        _logger.info("Received invoice request response:\n%s", pprint.pformat(invoice_data))

        # Extract the payment link URL and embed it in the redirect form.
        rendering_values = {
            'api_url': invoice_data.get('webPaymentUrl')
        }
        return rendering_values

    def _tctp_prepare_invoice_request_payload(self):
        """ Create the payload for the invoice request based on the transaction values.
        :return: The request payload.
        :rtype: dict
        """
        base_url = self.provider_id.get_base_url()
        payload = {
            'merchantID': self.provider_id.tctp_merchant_id,
            'invoiceNo': self.reference,
            'description': self.reference,
            'amount': self.amount,
            'currencyCode': self.currency_id.name,
            'paymentChannel': [const.PAYMENT_METHODS_MAPPING.get(self.payment_method_code, self.payment_method_code.upper())],
            'uiParams': {
                'userInfo': {
                    'name': self.partner_name,
                },
            },
            'frontendReturnUrl': urls.url_join(base_url, '/payment/2c2p/return'),
            'backendReturnUrl': urls.url_join(base_url, '/payment/2c2p/notification/' + str(self.provider_id.id)),
        }

        if self.partner_id.mobile or self.partner_id.phone:
            payload['uiParams']['userInfo']['mobileNo'] = self.partner_id.mobile or self.partner_id.phone
        if self.partner_id.email:
            payload['uiParams']['userInfo']['email'] = self.partner_id.email

        return payload

    def _get_tx_from_notification_data(self, provider_code, notification_data):
        """Override of `payment` to find the transaction based on the notification data.

        :param str provider_code: The code of the provider that handled the transaction.
        :param dict notification_data: The notification data sent by the provider.
        :return: The transaction if found.
        :rtype: payment.transaction
        :raise ValidationError: If inconsistent data were received.
        :raise ValidationError: If the data match no transaction.
        """
        tx = super()._get_tx_from_notification_data(provider_code, notification_data)
        if provider_code != '2c2p' or len(tx) == 1:
            return tx

        reference = notification_data.get('invoiceNo', '')
        if not reference:
            raise ValidationError("2C2P: " + _("Received data with missing reference."))

        tx = self.search([('reference', '=', reference), ('provider_code', '=', '2c2p')])
        if not tx:
            raise ValidationError(
                "2C2P: " + _("No transaction found matching reference %s.", reference)
            )
        return tx

    def _process_notification_data(self, notification_data):
        """ Override of `payment` to process the transaction based on 2C2P data.
        Note: self.ensure_one()
        :param dict notification_data: The notification data sent by the provider.
        :return: None
        :raise ValidationError: If inconsistent data were received.
        """
        super()._process_notification_data(notification_data)
        if self.provider_code != '2c2p':
            return

        # Update the provider reference.
        self.provider_reference = notification_data.get('tranRef')

        payment_status = notification_data.get('respCode')
        if payment_status in const.PAYMENT_STATUS_MAPPING['pending']:
            self._set_pending()
        elif payment_status in const.PAYMENT_STATUS_MAPPING['done']:
            self._set_done()
        elif payment_status in const.PAYMENT_STATUS_MAPPING['cancel']:
            self._set_canceled()
        elif payment_status in const.PAYMENT_STATUS_MAPPING['error']:
            self._set_error(_(
                "An error occurred during the processing of your payment (status %s : %s). Please try again",
                payment_status, notification_data.get('respDesc')
            ))
