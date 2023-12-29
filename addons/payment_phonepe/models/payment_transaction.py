# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
import pprint
import base64
import json
import hashlib

from odoo import _, models
from odoo.exceptions import ValidationError

from odoo.addons.payment import utils as payment_utils
from odoo.addons.payment_phonepe import const
from odoo.addons.payment_phonepe.controllers.main import PhonePeController

_logger = logging.getLogger(__name__)

class PaymentTransaction(models.Model):
    _inherit = 'payment.transaction'

    def _phonepe_encode_payload(self, payload):
        self.ensure_one()
        json_str = json.dumps(payload, separators=(',', ':'))
        return base64.urlsafe_b64encode(bytes(json_str, "utf-8")).decode("utf-8")

    def _phonepe_prepare_checksum(self, encoded_data, refund, is_response=False):
        self.ensure_one()
        if not is_response:
            additional_end_point = 'pay' if not refund else 'refund'
            verification_str = "%s%s%s%s" % (encoded_data, const.END_POINT, Additional_end_point, self.provider_id.phonepe_salt_key)
            shasign = hashlib.sha256(verification_str.encode())
            x_verify = "%s%s%s" % (shasign.hexdigest(), const.SSTRING, self.provider_id.phonepe_salt_index)
        else:
            verification_str = "%s%s" % (encoded_data, self.provider_id.phonepe_salt_key)
            shasign = hashlib.sha256(verification_str.encode())
            x_verify = "%s%s%s" % (shasign.hexdigest(), const.SSTRING, self.provider_id.phonepe_salt_index)
        return x_verify

    def _phonepe_decode_payload(self, encoded_data):
        decoded_data = base64.b64decode(bytes(encoded_data, "utf-8"))
        json_data = decoded_data.decode('utf-8')
        return json.loads(json_data)

    def _phonepe_intiate_transaction(self, payload, refund=False):
        self.ensure_one()
        base_url = self.get_base_url()
        encoded_payload = self._phonepe_encode_payload(payload)
        checksum = self._phonepe_prepare_checksum(encoded_payload, refund)
        headers = {
            'Content-Type': 'application/json',
            'X-Verify': checksum,
            'X-CALLBACK-URL': "%s%s" % (base_url, PhonePeController._callback_url),
        }
        data = {
            'request': encoded_payload
        }
        return headers, data

    def _get_specific_rendering_values(self, processing_values):
        res = super()._get_specific_rendering_values(processing_values)
        if self.provider_code != 'phonepe':
            return res
        converted_amount = payment_utils.to_minor_currency_units(self.amount, self.currency_id)
        base_url = self.get_base_url()
        payload = {
            'merchantId': self.provider_id.phonepe_merchant_id,
            'merchantTransactionId': self.reference,
            'merchantUserId': self.partner_email,
            'amount': converted_amount,
            'redirectUrl': "%s%s" % (base_url, PhonePeController._return_url),
            'redirectMode': 'POST',
            'callbackUrl': "%s%s" % (base_url, PhonePeController._callback_url),
            'mobileNumber': self.partner_phone,
            'paymentInstrument': {
                'type': 'PAY_PAGE'
            },
        }

        headers, data  = self._phonepe_intiate_transaction(payload)
        response = self.provider_id._phonepe_make_request(data=data, headers=headers)
        _logger.info(
            "Payload of '/orders' request for transaction with reference %s:\n%s",
            self.reference, pprint.pformat(payload)
        )
        checkout_url = response.get('data', {}).get('instrumentResponse', {}).get('redirectInfo', {}).get('url')
        return payload.update({'api_url': checkout_url})

    def _send_refund_request(self, amount_to_refund=None):
        """
        """
        refund_tx = super()._send_refund_request(amount_to_refund=amount_to_refund)
        if self.provider_code != 'phonepe':
            return refund_tx

        # Make the refund request to phonepe.
        converted_amount = payment_utils.to_minor_currency_units(
            -refund_tx.amount, refund_tx.currency_id
        )  # The amount is negative for refund transactions.
        payload = {
            "merchantId": self.provider_id.phonepe_merchant_id,
            "merchantUserId": self.partner_email,
            "originalTransactionId": self.provider_reference,
            "merchantTransactionId": self.reference,
            "amount": converted_amount,
            "callbackUrl": "%s%s" % (base_url, PhonePeController._callback_url),
        }

        _logger.info(
            "Payload of '/payments/<id>/refund' request for transaction with reference %s:\n%s",
            self.reference, pprint.pformat(payload)
        )

        headers, data  = self._phonepe_intiate_transaction(payload, refund=True)
        response_content = refund_tx.provider_id._phonepe_make_request(data=data, headers=headers, refund=True)
        _logger.info(
            "Response of '/payments/<id>/refund' request for transaction with reference %s:\n%s",
            self.reference, pprint.pformat(response_content)
        )
        response_content.update(entity_type='refund')
        refund_tx._handle_notification_data('phonepe', response_content)

        return refund_tx

    def _get_tx_from_notification_data(self, provider_code, notification_data):
        tx = super()._get_tx_from_notification_data(provider_code, notification_data)
        if provider_code != 'phonepe' or len(tx) == 1:
            return tx
        reference = notification_data.get('merchantTransactionId')
        if not reference:
            raise ValidationError(
                "PHONEPE: " + _("Received data with missing reference (%s)", reference)
            )
        tx = self.search([('reference', '=', reference), ('provider_code', '=', 'phonepe')])
        if not tx:
            raise ValidationError(
                "PHONEPE: " + _("No transaction found matching reference %s.", reference)
            )
        return tx

    def _process_notification_data(self, notification_data):
        """ Override of payment to process the transaction based on PhonePe data.
        Note: self.ensure_one()
        :param dict notification_data: The notification data sent by the provider
        :return: None
        """

        super()._process_notification_data(notification_data)
        if self.provider_code != 'phonepe':
            return
        # Update the provider reference.
        self.provider_reference = notification_data.get('merchantTransactionId')

        # Update the payment method
        payment_option = notification_data.get('paymentInstrument', '').get('type', '')
        payment_method = self.env['payment.method']._get_from_code(payment_option.lower())
        self.payment_method_id = payment_method or self.payment_method_id

        # Update the payment state.
        order_status = notification_data.get('code')
        if order_status == 'PAYMENT_SUCCESS':
            self._set_done()
        else:
            self._set_error("The something went wrong") #[IMP] For PAYMENT_ERROR
        #   TODO checkother response code
            self._set_canceled()
