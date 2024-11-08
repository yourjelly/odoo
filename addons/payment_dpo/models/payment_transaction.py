# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
import pprint

from odoo import _, models

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

        transaction_token = self._dpo_create_token()

        redirect_url = transaction_token.get('redirectUrl')
        #TODO-DPO: replace with correct value (url with the Transaction Token)

        return {'api_url': redirect_url}


    def _dpo_create_token(self):
        """ Create a transaction token and return the response data.

        :return: The transaction token data.
        :rtype: dict
        """
        self.ensure_one()

        #TODO-DPO replace with variables
        payload = f"""
            <?xml version="1.0" encoding="utf-8"?>
            <API3G>
                <CompanyToken>{self.provider_id.dpo_company_token}</CompanyToken>
                <Request>createToken</Request>
                <Transaction>
                    <PaymentAmount>100</PaymentAmount>
                    <PaymentCurrency>USD</PaymentCurrency>
                </Transaction>
                <Services>
                    <Service>
                        <ServiceType>{self.provider_id.dpo_service}</ServiceType>
                        <ServiceDescription>Attempt to pay with DPO</ServiceDescription>
                        <ServiceDate>2024/11/02 19:00</ServiceDate>
                    </Service>
                </Services>
            </API3G>
        """

        _logger.info(
            "Sending 'createToken' request for transaction with reference %s:\n%s",
            self.reference, pprint.pformat(payload)
        )
        token_data = self.provider_id._dpo_make_request('payment', payload=payload)
        _logger.info(
            "Response of 'createToken' request for transaction with reference %s:\n%s",
            self.reference, pprint.pformat(token_data)
        )
        return token_data

    #TODO-DPO: need direct payment? (_send_payment_request)
    #TODO-DPO add _get_tx_from_notification_data
    #TODO-DPO add _process_notification_data
    #TODO-DPO tokenization? (_dpo_tokenize_from_notification_data)
