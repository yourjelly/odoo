# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.exceptions import ValidationError
from odoo.addons.payment_2c2p.const import STATUS_MAPPING
from odoo import models

class PaymentTransaction(models.Model):
    _inherit = "payment.transaction"

    def _get_tx_from_notification_data(self, provider_code, notification_data):
        """Override of `payment` to find the transaction based on the data

        :param str provider_code: code that handles the transaction
        :param dict notification_data: 'normalized' notification data sent by the provider
        :return: The transaction if found
        :rtype: recordset of `payment.transaction`
        """
        tx = super()._get_tx_from_notification_data(provider_code, notification_data)
        if provider_code != '2c2p' or len(tx) == 1:
            return tx
        
        ref = notification_data.get('invoiceNo', '')
        if not ref:
            raise ValidationError("2C2P: No reference found in %s" % notification_data)
        
        tx = self.search([('reference', '=', ref), ('provider_code', '=', '2c2p')])
        if not tx:
            raise ValidationError("2C2P: No Transaction found for matching reference %s" % ref)
        
        return tx

    def _process_notification_data(self, notification_data):
        """Override of `payment` to process the transaction based on Razorpay data

        Depending on the data, get the status from data and update status of transaction accordingly
        If payment is done through credit card on the payment page, notification_data should include 'credit_card_token' information,
        which we will store internally and used for charges in the future
        """
        super()._process_notification_data(notification_data)
        if self.provider_code != '2c2p':
            return

        # payment status is either PAID or EXPIRED
        payment_status = notification_data.get('respCode')
        if not self.provider_reference and payment_status in (STATUS_MAPPING['done'] + STATUS_MAPPING['pending']) and notification_data.get('tranRef'):
            self.provider_reference = notification_data.get('tranRef')

        if payment_status in STATUS_MAPPING['done']:
            self._set_done()
        elif payment_status in STATUS_MAPPING['pending']:
            self._set_pending()
        elif payment_status in STATUS_MAPPING['cancel']:
            self._set_canceled()
        elif payment_status in STATUS_MAPPING['error']:
            self._set_error()
