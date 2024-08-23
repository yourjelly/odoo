# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
import pprint

from werkzeug import urls

from odoo import _, api, fields, models
from odoo.exceptions import ValidationError

from odoo.addons.payment import utils as payment_utils
from odoo.addons.payment_paypal.const import PAYMENT_STATUS_MAPPING, CAPTURE, AUTHORIZE
from odoo.addons.payment_paypal.controllers.main import PaypalController

_logger = logging.getLogger(__name__)


class PaymentTransaction(models.Model):
    _inherit = 'payment.transaction'

    # See https://developer.paypal.com/docs/api-basics/notifications/ipn/IPNandPDTVariables/
    # this field has no use in Odoo except for debugging
    paypal_type = fields.Char(string="PayPal Transaction Type")

    def _get_specific_processing_values(self, processing_values):
        """ Override of payment to return Paypal-specific processing values.

        Note: self.ensure_one() from `_get_processing_values`

        :param dict processing_values: The generic and specific processing values of the transaction
        :return: The dict of provider-specific processing values
        :rtype: dict
        """
        res = super()._get_specific_processing_values(processing_values)
        if self.provider_code != 'paypal':
            return res
        partner_first_name, partner_last_name = payment_utils.split_partner_name(self.partner_name)
        payload = {
            'intent': AUTHORIZE if self.provider_id.capture_manually else CAPTURE,
            'purchase_units': [
                {
                    'reference_id': self.reference,
                    'amount': {
                        'currency_code': self.currency_id.name,
                        'value': self.amount,
                    },
                    'payee':  {
                        'email_address': self.provider_id._get_normalized_paypal_email_account(),
                        'display_data': {
                            'business_email':  self.provider_id.company_id.email,
                            'brand_name': self.provider_id.company_id.name,
                        }
                    },
                },
            ],
            "payment_source": {
                "paypal": {
                    "experience_context": {
                        "shipping_preference": "NO_SHIPPING",
                    },
                },
            },
        }

        response_content = self.provider_id._paypal_make_request(
            endpoint='/v2/checkout/orders',
            payload=payload,
        )
        return {'order_id': response_content['id']}

    def _get_tx_from_notification_data(
        self, provider_code, notification_data, is_authorize=False
    ):
        """ Override of payment to find the transaction based on Paypal data.

        :param str provider_code: The code of the provider that handled the transaction
        :param dict notification_data: The notification data sent by the provider
        :return: The transaction if found
        :rtype: recordset of `payment.transaction`
        :raise: ValidationError if the data match no transaction
        """
        tx = super()._get_tx_from_notification_data(provider_code, notification_data)
        if provider_code != 'paypal' or len(tx) == 1:
            return tx

        reference = notification_data.get('reference_id')
        tx = self.search([('reference', '=', reference), ('provider_code', '=', 'paypal')])
        if not tx and is_authorize:
            tx = self.search([
                ('provider_reference', '=', reference),
                ('provider_code', '=', 'paypal'),
            ])
        if not tx:
            raise ValidationError(
                "PayPal: " + _("No transaction found matching reference %s.", reference)
            )
        return tx

    def _set_status_from_notification(
            self, payment_status=None, txn_type=None, pending_reason=None,
    ):
        if payment_status in PAYMENT_STATUS_MAPPING['pending']:
            self._set_pending(state_message=notification_data.get('pending_reason'))
        elif payment_status in PAYMENT_STATUS_MAPPING['done']:
            if txn_type == AUTHORIZE:
                self._set_authorized()
            else:
                self._set_done()
        elif payment_status in PAYMENT_STATUS_MAPPING['cancel']:
            self._set_canceled()
        else:
            _logger.info(
                "received data with invalid payment status (%s) for transaction with reference %s",
                payment_status, self.reference
            )
            self._set_error(
                "PayPal: " + _("Received data with invalid payment status: %s", payment_status)
            )

    def _process_notification_data(self, notification_data):
        """ Override of payment to process the transaction based on Paypal data.

        Note: self.ensure_one()

        :param dict notification_data: The notification data sent by the provider
        :return: None
        :raise: ValidationError if inconsistent data were received
        """
        super()._process_notification_data(notification_data)
        if self.provider_code != 'paypal':
            return

        if not notification_data:
            self._set_canceled(state_message=_("The customer left the payment page."))
            return

        amount = notification_data.get('amount').get('value')
        currency_code = notification_data.get('amount').get('currency_code')
        # Update the provider reference.
        txn_id = notification_data.get('id')
        # Update the payment state.
        payment_status = notification_data.get('status')
        txn_type = notification_data.get('txn_type')

        assert amount and currency_code, 'PayPal: missing amount or currency'
        assert self.currency_id.compare_amounts(float(amount), self.amount) == 0, \
            'PayPal: mismatching amounts'
        assert currency_code == self.currency_id.name, 'PayPal: mismatching currency codes'

        if not all((txn_id, txn_type)):
            raise ValidationError(
                "PayPal: " + _(
                    "Missing value for txn_id (%(txn_id)s) or txn_type (%(txn_type)s).",
                    txn_id=txn_id, txn_type=txn_type
                )
            )
        self.provider_reference = txn_id
        self.paypal_type = txn_type

        # Force PayPal as the payment method if it exists.
        self.payment_method_id = self.env['payment.method'].search(
            [('code', '=', 'paypal')], limit=1
        ) or self.payment_method_id
        assert self.payment_method_id.code in notification_data.get(
            'payment_source'), 'PayPal: mismatching payment methods'
        self._set_status_from_notification(
            payment_status=payment_status,
            txn_type=txn_type,
            pending_reason=notification_data.get('pending_reason'),
        )

    def _send_capture_request(self, amount_to_capture=None):
        """ Override of `payment` to send a capture request to Stripe. """
        child_capture_tx = super()._send_capture_request(amount_to_capture=amount_to_capture)
        if self.provider_code != 'paypal':
            return child_capture_tx

        # Make the capture request to Paypal
        capture_response = self.provider_id._paypal_make_request(
            endpoint=f'/v2/payments/authorizations/{self.provider_reference}/capture',
        )
        _logger.info(
            "capture request response for transaction with reference %s:\n%s",
            self.reference, pprint.pformat(capture_response)
        )
        self._set_status_from_notification(capture_response.get('status'))
        return child_capture_tx

    def _send_void_request(self, amount_to_void=None):
        """ Override of `payment` to send a void request to Stripe. """
        child_void_tx = super()._send_void_request(amount_to_void=amount_to_void)
        if self.provider_code != 'paypal':
            return child_void_tx

        # Make the void request to Stripe
        void_response = self.provider_id._paypal_make_request(
            endpoint=f'/v2/payments/authorizations/{self.provider_reference}/void',
        )
        _logger.info(
            "void request response for transaction with reference %s:\n%s",
            self.reference, pprint.pformat(void_response)
        )

        # Handle the void request response
        self._set_status_from_notification(void_response.get('status'))

        return child_void_tx
