# Part of Odoo. See LICENSE file for full copyright and licensing details.

import hashlib
import secrets
import string

from werkzeug import urls
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

from odoo import _, models, fields
from odoo.exceptions import ValidationError

from odoo.addons.payment_hdfc.const import MAPPING_PAYMENT_METHODS
from odoo.addons.payment_hdfc.controllers.main import HdfcController

iv = b'\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0a\x0b\x0c\x0d\x0e\x0f'

class PaymentTransaction(models.Model):
    _inherit = 'payment.transaction'

    hdfc_transaction_verify_key = fields.Char("HDFC transaction verify key")

    def _hdfc_pad(self, data):
        length = 16 - (len(data) % 16)
        data += bytes([length] * length)
        return data

    def _hdfc_encrypt_text(self, plaintext):
        self.ensure_one()
        plaintext = self._hdfc_pad(plaintext.encode())
        encDigest = hashlib.md5()
        encDigest.update(self.provider_id.hdfc_working_key.encode())
        key = encDigest.digest()
        cipher = Cipher(algorithms.AES(key), modes.CBC(iv))
        encryptor = cipher.encryptor()
        encrypted_text = encryptor.update(plaintext) + encryptor.finalize()
        return encrypted_text.hex()

    def _hdfc_decrypt_text(self, ciphertext):
        self.ensure_one()
        dec_digest = hashlib.md5()
        dec_digest.update(self.provider_id.hdfc_working_key.encode())
        key = dec_digest.digest()
        encrypted_text = bytes.fromhex(ciphertext)
        cipher = Cipher(algorithms.AES(key), modes.CBC(iv))
        decryptor = cipher.decryptor()
        decrypted_text = decryptor.update(encrypted_text) + decryptor.finalize()
        return decrypted_text.decode()

    def _hdfc_generate_transaction_key(self):
        return ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(16))

    def _get_specific_rendering_values(self, processing_values):
        """ Override of payment to return Payumoney-specific rendering values.

        Note: self.ensure_one() from `_get_processing_values`

        :param dict processing_values: The generic and specific processing values of the transaction
        :return: The dict of provider-specific processing values
        :rtype: dict
        """
        res = super()._get_specific_rendering_values(processing_values)
        if self.provider_code != 'hdfc':
            return res
        base_url = self.get_base_url()
        api_url = self.provider_id._hdfc_get_api_url()
        self.hdfc_transaction_verify_key = self._hdfc_generate_transaction_key()
        encrypt_values = {
                            'merchant_id': self.provider_id.hdfc_merchant_id,
                            'order_id': self.reference,
                            'currency': self.currency_id.name,
                            'amount': self.amount,
                            'redirect_url': urls.url_join(base_url, HdfcController._return_url),
                            'cancel_url': urls.url_join(base_url, HdfcController._cancel_url),
                            'language': 'EN',
                            'customer_identifier': self.partner_email,
                            'merchant_param1': self.hdfc_transaction_verify_key,
                            'merchant_param2': self.hdfc_transaction_verify_key,
                            'merchant_param3': self.hdfc_transaction_verify_key,
                            'merchant_param4': self.hdfc_transaction_verify_key,
                            'merchant_param5': self.hdfc_transaction_verify_key,
                        }
        request_vals = {
            'api_url': api_url,
            'command': 'initiateTransaction',
            'merchant_id': self.provider_id.hdfc_merchant_id,
            'encRequest': self._hdfc_encrypt_text(urls.url_encode(encrypt_values)),
            'access_code': self.provider_id.hdfc_access_code,
        }
        return request_vals

    def _get_tx_from_notification_data(self, provider_code, notification_data):
        """ Override of payment to find the transaction based on HDFC data.

        :param str provider_code: The code of the provider that handled the transaction
        :param dict notification_data: The notification data sent by the provider
        :return: The transaction if found
        :rtype: recordset of `payment.transaction`
        :raise: ValidationError if inconsistent data were received
        :raise: ValidationError if the data match no transaction
        """
        tx = super()._get_tx_from_notification_data(provider_code, notification_data)
        if provider_code != 'hdfc' or len(tx) == 1:
            return tx
        reference = notification_data.get('orderNo')
        if not reference:
            raise ValidationError(
                "HDFC: " + _("Received data with missing reference (%s)", reference)
            )

        tx = self.search([('reference', '=', reference), ('provider_code', '=', 'hdfc')])
        if not tx:
            raise ValidationError(
                "HDFC: " + _("No transaction found matching reference %s.", reference)
            )

        return tx

    def _process_notification_data(self, notification_data):
        """ Override of payment to process the transaction based on HDFC data.

        Note: self.ensure_one()

        :param dict notification_data: The notification data sent by the provider
        :return: None
        """
        super()._process_notification_data(notification_data)
        if self.provider_code != 'hdfc':
            return

        # Update the provider reference.
        encrypted_text = notification_data.get('encResp')
        decrypted_text = self._hdfc_decrypt_text(encrypted_text)
        data = urls.url_decode(decrypted_text)
        self.provider_reference = data.get('tracking_id')

        # Update the payment method
        payment_mode = data.get('payment_mode', '').lower()
        payment_method_type = MAPPING_PAYMENT_METHODS.get(payment_mode)
        payment_method = self.env['payment.method']._get_from_code(payment_method_type)
        self.payment_method_id = payment_method or self.payment_method_id

        # Update the payment state.
        order_status = data.get('order_status').lower()
        if order_status == 'success':
            self._set_done()
        else:
            message = data.get('failure_message') or data.get('status_message')
            if message == 'N':
                self._set_canceled()
            else:
                self._set_error("The payment was %s due to %s" % (order_status, message))
