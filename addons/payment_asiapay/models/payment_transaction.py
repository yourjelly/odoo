# Part of Odoo. See LICENSE file for full copyright and licensing details.

import base64
import logging
import pprint

from werkzeug import urls
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import padding
from cryptography.hazmat.backends import default_backend

from odoo import _, api, models
from odoo.exceptions import ValidationError, UserError

from odoo.addons.payment import utils as payment_utils
from odoo.addons.payment_asiapay import const
from odoo.addons.payment_asiapay.controllers.main import AsiaPayController


_logger = logging.getLogger(__name__)


class PaymentTransaction(models.Model):
    _inherit = 'payment.transaction'

    @api.model
    def _compute_reference(self, provider_code, prefix=None, separator='-', **kwargs):
        """ Override of `payment` to ensure that AsiaPay requirements for references are satisfied.

        AsiaPay requirements for references are as follows:
        - References must be unique at provider level for a given merchant account.
          This is satisfied by singularizing the prefix with the current datetime. If two
          transactions are created simultaneously, `_compute_reference` ensures the uniqueness of
          references by suffixing a sequence number.
        - References must be at most 35 characters long.

        :param str provider_code: The code of the provider handling the transaction.
        :param str prefix: The custom prefix used to compute the full reference.
        :param str separator: The custom separator used to separate the prefix from the suffix.
        :return: The unique reference for the transaction.
        :rtype: str
        """
        if provider_code != 'asiapay':
            return super()._compute_reference(provider_code, prefix=prefix, **kwargs)

        if not prefix:
            # If no prefix is provided, it could mean that a module has passed a kwarg intended for
            # the `_compute_reference_prefix` method, as it is only called if the prefix is empty.
            # We call it manually here because singularizing the prefix would generate a default
            # value if it was empty, hence preventing the method from ever being called and the
            # transaction from received a reference named after the related document.
            prefix = self.sudo()._compute_reference_prefix(provider_code, separator, **kwargs) or None
        prefix = payment_utils.singularize_reference_prefix(prefix=prefix, max_length=35)
        return super()._compute_reference(provider_code, prefix=prefix, **kwargs)

    def _get_processing_values(self):
        processing_values = super()._get_processing_values()
        if self.provider_code != 'asiapay':
            return processing_values

        if self.operation in ('online_token'):
            redirect_form_view = self.provider_id._get_redirect_form_view(
                is_validation=self.operation == 'validation'
            )
            if redirect_form_view:  # Some provider don't need a redirect form.
                rendering_values = self._get_specific_rendering_values(processing_values)
                _logger.info(
                    "provider-specific rendering values for transaction with reference "
                    "%(ref)s:\n%(values)s",
                    {'ref': self.reference, 'values': pprint.pformat(rendering_values)},
                )
                redirect_form_html = self.env['ir.qweb']._render(redirect_form_view.id, rendering_values)
                processing_values.update(redirect_form_html=redirect_form_html)

        return processing_values

    def _get_specific_rendering_values(self, processing_values):
        """ Override of `payment` to return AsiaPay-specific rendering values.

        Note: self.ensure_one() from `_get_processing_values`.

        :param dict processing_values: The generic and specific processing values of the
                                       transaction.
        :return: The dict of provider-specific processing values.
        :rtype: dict
        """
        def get_language_code(lang_):
            """ Return the language code corresponding to the provided lang.

            If the lang is not mapped to any language code, the country code is used instead. In
            case the country code has no match either, we fall back to English.

            :param str lang_: The lang, in IETF language tag format.
            :return: The corresponding language code.
            :rtype: str
            """
            language_code_ = const.LANGUAGE_CODES_MAPPING.get(lang_)
            if not language_code_:
                country_code_ = lang_.split('_')[0]
                language_code_ = const.LANGUAGE_CODES_MAPPING.get(country_code_)
            if not language_code_:
                language_code_ = const.LANGUAGE_CODES_MAPPING['en']
            return language_code_

        res = super()._get_specific_rendering_values(processing_values)
        if self.provider_code != 'asiapay':
            return res

        base_url = self.provider_id.get_base_url()
        # The lang is taken from the context rather than from the partner because it is not required
        # to be logged in to make a payment, and because the lang is not always set on the partner.
        lang = self._context.get('lang') or 'en_US'
        rendering_values = {
            'merchant_id': self.provider_id.asiapay_merchant_id,
            'amount': self.amount,
            'reference': self.reference,
            'currency_code': const.CURRENCY_MAPPING[self.currency_id.name],
            'mps_mode': 'SCP',
            'return_url': urls.url_join(base_url, AsiaPayController._return_url),
            'payment_type': 'H' if self.provider_id.capture_manually else 'N',
            'language': get_language_code(lang),
            'payment_method': 'ALL',
        }
        if (self.tokenize or self.token_id) and self.partner_id:
            rendering_values['memberpay_service'] = 'T'
            rendering_values['memberpay_memberid'] = self._asiapay_create_member_id()
            if self.token_id:
                rendering_values['memberpay_token'] = self._asiapay_create_otp()
        rendering_values.update({
            'secure_hash': self.provider_id._asiapay_calculate_signature(
                rendering_values, incoming=False
            ),
            'api_url': urls.url_join(self.provider_id._asiapay_get_api_url(), 'payment/payForm.jsp')
        })
        return rendering_values

    # def _send_payment_request(self):
    #     """ Override of `payment` to send a payment request to Asiapay.

    #     Note: self.ensure_one()

    #     :return: None
    #     :raise: UserError: if the transaction is not linked to a token.
    #     """
    #     super()._send_payment_request()
    #     if self.provider_code != 'asiapay':
    #         return

    def _asiapay_create_otp(self):
        """ Create a one-time password for the transaction.

        :return: The one-time token.
        """
        data = self.provider_id._asiapay_make_request(
            'MemberPayApi.jsp', 'GenerateToken', payload={
                'merchantApiId': self.provider_id.asiapay_api_login_id,
                'memberId': self._asiapay_create_member_id(),
                'orderRef': self.reference,
                'currCode': const.CURRENCY_MAPPING[self.currency_id.name],
                'amount': self.amount,
                'staticToken': self.token_id.provider_ref,
            }
        )
        return data['token']

    def _asiapay_create_member_id(self):
        """ Create a member ID for the transaction.

        :return: The member ID.
        """
        return "{} (id:{})".format(self.partner_name, str(self.partner_id.id))

    def _get_tx_from_notification_data(self, provider_code, notification_data):
        """ Override of `payment` to find the transaction based on AsiaPay data.

        :param str provider_code: The code of the provider that handled the transaction.
        :param dict notification_data: The notification data sent by the provider.
        :return: The transaction if found.
        :rtype: recordset of `payment.transaction`
        :raise ValidationError: If inconsistent data are received.
        :raise ValidationError: If the data match no transaction.
        """
        tx = super()._get_tx_from_notification_data(provider_code, notification_data)
        if provider_code != 'asiapay' or len(tx) == 1:
            return tx

        if 'action' in notification_data:
            reference = notification_data.get('ref')
        else:
            reference = notification_data.get('Ref')
        if not reference:
            raise ValidationError(
                "AsiaPay: " + _("Received data with missing reference %(ref)s.", ref=reference)
            )

        tx = self.search([('reference', '=', reference), ('provider_code', '=', 'asiapay')])
        if not tx:
            raise ValidationError(
                "AsiaPay: " + _("No transaction found matching reference %s.", reference)
            )

        return tx

    def _send_refund_request(self, amount_to_refund=None):
        """ Override of `payment` to explain that it is impossible to refund a Asiapay transaction.
        """
        child_refund_tx = super()._send_refund_request(amount_to_refund=amount_to_refund)
        if self.provider_code != 'asiapay':
            return child_refund_tx

        amount = self.currency_id.round(amount_to_refund) if amount_to_refund else None
        data = self.provider_id._asiapay_make_request(
            'onlineApi.jsp', 'OnlineReversal', payload={
                'payRef': self.provider_reference,
                'amount': amount,
            }
        )
        _logger.info(
            "Refund request response for transaction wih reference %s:\n%s",
            self.reference, pprint.pformat(data)
        )

        data['PayRef'] = data.get('payRef')
        data['successcode'] = data.get('resultCode')

        child_refund_tx._handle_notification_data('asiapay', data)

        return child_refund_tx

    def _send_capture_request(self, amount_to_capture=None):
        """ Override of payment to send a capture request to Asiapay.

        Note: self.ensure_one()

        :param float amount_to_capture: The amount to capture.
        :return: The capture transaction created to process the capture request.
        :rtype: recordset of `payment.transaction`
        """
        if self.provider_code == 'asiapay' and self.child_transaction_ids:
            raise UserError(_("You cannot capture a transaction that has already been captured."))

        child_capture_tx = super()._send_capture_request(amount_to_capture=amount_to_capture)
        if self.provider_code != 'asiapay':
            return child_capture_tx

        amount = self.currency_id.round(amount_to_capture) if amount_to_capture else None
        data = self.provider_id._asiapay_make_request(
            'orderApi.jsp', 'Capture', payload={
                'payRef': self.provider_reference,
                'amount': amount,
            }
        )
        _logger.info(
            "Capture request response for transaction wih reference %s:\n%s",
            self.reference, pprint.pformat(data)
        )

        data['successcode'] = data.get('resultCode')
        if data.get('resultCode') == '0':
            child_capture_tx.provider_reference = data.get('payRef')
            data['PayRef'] = self.provider_reference
            if amount_to_capture:
                child_capture_tx.amount, self.amount = self.amount, amount_to_capture

        self._handle_notification_data('asiapay', data)

        return child_capture_tx

    def _send_void_request(self, amount_to_void=None):
        """ Override of payment to send a void request to Asiapay.

        Note: self.ensure_one()

        :param float amount_to_void: The amount to void.
        :return: The void transaction created to process the void request.
        :rtype: recordset of `payment.transaction`
        """
        child_void_tx = super()._send_void_request(amount_to_void=amount_to_void)
        if self.provider_code != 'asiapay':
            return child_void_tx

        amount = self.currency_id.round(amount_to_void) if amount_to_void else None
        self.provider_id._asiapay_make_request(
            'orderApi.jsp', 'Capture', payload={
                'payRef': self.provider_reference,
                'amount': amount,
            }
        )
        data = self.provider_id._asiapay_make_request(
            'onlineApi.jsp', 'OnlineReversal', payload={
                'payRef': self.provider_reference,
                'amount': amount,
            }
        )
        _logger.info(
            "Void request response for transaction wih reference %s:\n%s",
            self.reference, pprint.pformat(data)
        )

        data['PayRef'] = data.get('payRef')
        data['successcode'] = data.get('resultCode')
        self._handle_notification_data('asiapay', data)

        return child_void_tx

    def _process_notification_data(self, notification_data):
        """ Override of `payment' to process the transaction based on AsiaPay data.

        Note: self.ensure_one()

        :param dict notification_data: The notification data sent by the provider.
        :return: None
        :raise ValidationError: If inconsistent data are received.
        """
        super()._process_notification_data(notification_data)
        if self.provider_code != 'asiapay':
            return

        self.provider_reference = notification_data.get('PayRef')
        success_code = notification_data.get('successcode')
        primary_response_code = notification_data.get('prc')

        if self.provider_id.asiapay_api_login_id and self.provider_id.asiapay_api_password:
            data = self.provider_id._asiapay_make_request(
                'orderApi.jsp', 'Query', payload={
                    'payRef': self.provider_reference,
                }
            )
            _logger.info("Order status received from AsiaPay with data:\n%s", pprint.pformat(data))

            status = data.get('orderStatus')
            if status in const.STATUS_MAPPING['pending']:
                self._set_pending()
            elif status in const.STATUS_MAPPING['authorized']:
                if self.tokenize and notification_data.get('mpLatestStaticToken'):
                    self._asiapay_tokenize_from_notification_data(notification_data)
                self._set_authorized()
            elif status in const.STATUS_MAPPING['done']:
                if self.tokenize and notification_data.get('mpLatestStaticToken'):
                    self._asiapay_tokenize_from_notification_data(notification_data)
                self._set_done("Test")
                if self.operation == 'refund':
                    self.env.ref('payment.cron_post_process_payment_tx')._trigger()
            elif status in const.STATUS_MAPPING['cancel']:
                self._set_canceled()
            elif success_code in const.SUCCESS_CODE_MAPPING['error']:
                if primary_response_code:
                    self._set_error(_(
                        "An error occurred during the processing of your payment (success code %s; primary "
                        "response code %s). Please try again.", success_code, primary_response_code
                    ))
                else:
                    self._set_error(_("An error occurred during the processing of your payment. Please "
                                    "try again."))
            else:
                _logger.warning(
                    "Received data with invalid success code (%s) for transaction with primary response "
                    "code %s and reference %s.", success_code, primary_response_code, self.reference
                )
                self._set_error("AsiaPay: " + _("Unknown success code: %s", success_code))
        else:
            if success_code in const.SUCCESS_CODE_MAPPING['done']:
                if self.tokenize and notification_data.get('mpLatestStaticToken'):
                    self._asiapay_tokenize_from_notification_data(notification_data)
                self._set_done()
            elif success_code in const.SUCCESS_CODE_MAPPING['error']:
                if primary_response_code:
                    self._set_error(_(
                        "An error occurred during the processing of your payment (success code %s; primary "
                        "response code %s). Please try again.", success_code, primary_response_code
                    ))
                else:
                    self._set_error(_("An error occurred during the processing of your payment. Please "
                                    "try again."))
            else:
                _logger.warning(
                    "Received data with invalid success code (%s) for transaction with primary response "
                    "code %s and reference %s.", success_code, primary_response_code, self.reference
                )
                self._set_error("AsiaPay: " + _("Unknown success code: %s", success_code))

    def _asiapay_tokenize_from_notification_data(self, notification_data):
        """ Create a new token based on the notification data.

        :param dict notification_data: The notification data built with Asiapay objects.
                                       See `_process_notification_data`.
        :return: None
        """
        def decrypt(cipher_text, key, salt) -> bytes:
            cipher_text = base64.urlsafe_b64decode(cipher_text)
            decryptor = Cipher(algorithms.AES(key), modes.CBC(salt), backend=default_backend()).decryptor()
            padder = padding.PKCS7(algorithms.AES(key).block_size).unpadder()
            decrypted_data = decryptor.update(cipher_text)
            unpadded = padder.update(decrypted_data) + padder.finalize()
            return unpadded

        key = self.provider_id.asiapay_tokenization_key.encode()[:32]
        salt = self.provider_id.asiapay_tokenization_salt.encode()[:16]
        encrypted_token = notification_data.get('mpLatestStaticToken')

        token = self.env['payment.token'].create({
            'provider_id': self.provider_id.id,
            'payment_details': notification_data.get('panLast4'),
            'partner_id': self.partner_id.id,
            'provider_ref': decrypt(encrypted_token, key, salt).decode(),
            'verified': True,
        })
        self.write({
            'token_id': token,
            'tokenize': False,
        })
        _logger.info(
            "created token with id %(token_id)s for partner with id %(partner_id)s from "
            "transaction with reference %(ref)s",
            {
                'token_id': token.id,
                'partner_id': self.partner_id.id,
                'ref': self.reference,
            },
        )
