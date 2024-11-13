# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
import pprint

from werkzeug import urls

from odoo import _, models
from odoo.addons.payment_dpo.controllers.main import DPOController


_logger = logging.getLogger(__name__)


class PaymentTransaction(models.Model):
    _inherit = ['payment.transaction']

    def _get_specific_rendering_values(self, processing_values):
        """ Override of `payment` to return DPO-specific processing values.

        Note: self.ensure_one() from `_get_processing_values`.

        :param dict processing_values: The generic processing values of the transaction.
        :return: The dict of provider-specific processing values.
        :rtype: dict
        """
        res = super()._get_specific_rendering_values(processing_values)
        if self.provider_code != 'dpo':
            return res

        payment_url = self.provider_id.dpo_payment_url.rstrip('TransToken') # Placeholder removed from payment URL
        transaction_token = self._dpo_create_token()
        redirect_url = f'{payment_url}{transaction_token}'

        return {'api_url': redirect_url}


    def _dpo_create_token(self):
        """ Create a transaction token and return the response data.

        :return: The transaction token data.
        :rtype: dict
        """
        self.ensure_one()

        return_url = urls.url_join(self.provider_id.get_base_url(), DPOController._return_url)
        payload = f"""
            <?xml version="1.0" encoding="utf-8"?>
            <API3G>
                <CompanyToken>{self.provider_id.dpo_company_token}</CompanyToken>
                <Request>createToken</Request>
                <Transaction>
                    <PaymentAmount>{self.amount}</PaymentAmount>
                    <PaymentCurrency>{self.currency_id.name}</PaymentCurrency>
                    <CompanyRef>{self.reference}</CompanyRef>
                    <RedirectURL>{return_url}</RedirectURL>
                </Transaction>
                <Services>
                    <Service>
                        <ServiceType>{self.provider_id.dpo_service}</ServiceType>
                        <ServiceDescription>{self.reference}</ServiceDescription>
                        <ServiceDate>{self.create_date}</ServiceDate>
                    </Service>
                </Services>
            </API3G>
        """
        #TODO-DPO create_date is not in the right format

        #TODO-DPO add Transaction BackURL to return to the cart
        #TODO-DPO add Transaction CompanyRefUnique to avoid double payments (idempotent key)
        #TODO-DPO add Transaction customerLastName, customerFirstName, customerEmail, customerAddress as it's displayed on the confirmation page.

        _logger.info(
            "Sending 'createToken' request for transaction with reference %s:\n%s",
            self.reference, pprint.pformat(payload) # TODO-DPO: can we log the credentials?
        )
        transaction_data = self.provider_id._dpo_make_request(payload=payload)
        _logger.info(
            "Response of 'createToken' request for transaction with reference %s:\n%s",
            self.reference, pprint.pformat(transaction_data)
        )
        # TODO-DPO do we need Result, ResultExplanation, TransRef?
        return transaction_data.get('TransToken')

    def _get_tx_from_notification_data(self, provider_code, notification_data):
        """ Override of `payment` to find the transaction based on DPO data.

        :param str provider_code: The code of the provider that handled the transaction.
        :param dict notification_data: The notification data sent by the provider.
        :return: The transaction if found.
        :rtype: payment.transaction
        :raise ValidationError: If inconsistent data are received.
        :raise ValidationError: If the data match no transaction.
        """
        tx = super()._get_tx_from_notification_data(provider_code, notification_data)
        if provider_code != 'dpo' or len(tx) == 1:
            return tx

        # TODO-DPO do it for DPO

        return tx

    def _process_notification_data(self, notification_data):
        """ Override of `payment' to process the transaction based on DPO data.

        Note: self.ensure_one()

        :param dict notification_data: The notification data sent by the provider.
        :return: None
        :raise ValidationError: If inconsistent data are received.
        """
        super()._process_notification_data(notification_data)

        # TODO-DPO do it for DPO

    #TODO-DPO implement Verify Transaction Token
    #TODO-DPO direct payment? (_send_payment_request)
    #TODO-DPO add _get_tx_from_notification_data
    #TODO-DPO add _process_notification_data
    #TODO-DPO tokenization? (_dpo_tokenize_from_notification_data)