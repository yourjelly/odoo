# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging

from odoo import _, models
from odoo.addons.payment import utils as payment_utils
from odoo.addons.payment.const import CURRENCY_MINOR_UNITS
from odoo.exceptions import ValidationError
from odoo.addons.payment_careem.const import STATUS_MAPPING

_logger = logging.getLogger(__name__)


class PaymentTransaction(models.Model):
    _inherit = 'payment.transaction'

    def _get_specific_rendering_values(self, processing_values):
        """ Override of `payment` to return CareemPay-specific rendering values.

        Note: self.ensure_one() from `_get_processing_values`.

        :param dict processing_values: The generic and specific processing values of the
                                       transaction.
        :return: The dict of provider-specific processing values.
        :rtype: dict
        """

        res = super()._get_specific_rendering_values(processing_values)
        if self.provider_code != 'careem':
            return res
        return {
            'api_url': self.provider_id._careem_get_redirection_url(),
            'invoice_id': self.provider_reference
        }

    def _get_tx_from_notification_data(self, provider_code, notification_data):
        """ Override of payment to find the transaction based on CareemPay data.

        :param str provider_code: The code of the provider that handled the transaction
        :param dict notification_data: The notification data sent by the provider
        :return: The transaction if found
        :rtype: recordset of `payment.transaction`
        :raise: ValidationError if the data match no transaction
        """
        tx = super()._get_tx_from_notification_data(provider_code, notification_data)
        if provider_code != 'careem' or len(tx) == 1:
            return tx
        reference = notification_data.get('id') or notification_data.get('invoiceId')
        if not reference:
            raise ValidationError(
                "Careem Pay: " + _("Received data with missing reference %(ref)s.", ref=reference)
            )

        tx = self.search([('provider_reference', '=', reference), ('provider_code', '=', 'careem')])
        if not tx:
            raise ValidationError(
                "Careem Pay: " + _("No transaction found matching provider's reference %s.", reference)
            )

        return tx

    def _get_specific_processing_values(self, processing_values):
        """ Override of payment to return CareemPay-specific processing values.

        Note: self.ensure_one() from `_get_processing_values`

        :param dict processing_values: The generic processing values of the transaction
        :return: The dict of provider-specific processing values
        :rtype: dict
        """
        res = super()._get_specific_processing_values(processing_values)
        if self.provider_code != 'careem':
            return res
        if not self.provider_reference:
            currency = self.currency_id
            minor_amount = payment_utils.to_minor_currency_units(
                self.amount, self.currency_id, CURRENCY_MINOR_UNITS.get(currency.name, currency.decimal_places)
            )
            data = self.provider_id._careem_get_invoice_id(minor_amount, currency.name, payment_utils.generate_idempotency_key(self))
            self.provider_reference = data.get('id')
        return {
            'id': self.provider_reference
        }

    def _process_notification_data(self, notification_data):
        """ Override of payment to process the transaction based on CareemPay data.

        Note: self.ensure_one()

        :param dict notification_data: The notification data sent by the provider
        :return: None
        :raise: ValidationError if inconsistent data were received
        """
        super()._process_notification_data(notification_data)
        if self.provider_code != 'careem':
            return
        invoice_id = notification_data.get('id')
        if invoice_id != self.provider_reference:
            raise ValidationError(
                "Careem Pay: " + _("Received data is of a different invoice.")
            )
        status = notification_data.get('status').lower()
        # Handle the provider reference and the status.
        if not status:
            raise ValidationError(
                "Careem Pay: " + _("Received data with missing status.")
            )

        if status in STATUS_MAPPING['draft']:
            pass
        elif status in STATUS_MAPPING['pending']:
            self._set_pending()
        elif status in STATUS_MAPPING['done']:
            self._set_done()
        elif status in STATUS_MAPPING['cancel']:
            self._set_canceled()
        elif status in STATUS_MAPPING['error']:
            self._set_error(_(
                "The payment did not go through. Please log into your Careem Dashboard to get "
                "more information on that matter, and address any accounting discrepancies."
            ))
        else:  # Classify unknown intent statuses as `error` tx state
            _logger.warning(
                "Received invalid payment status (%s) for transaction with reference %s",
                status, self.provider_reference
            )
            self._set_error(_("Received data with invalid status: %s", status))
