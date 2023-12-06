from odoo import _, api, fields, models
from odoo.addons.payment import utils as payment_utils
import logging
import uuid
from werkzeug.urls import url_encode, url_join
from odoo.addons.payment_phonepe.controllers.main import PhonePeController
import pprint
from odoo.addons.payment_phonepe import const

_logger = logging.getLogger(__name__)

class PaymentTransaction(models.Model):
    _inherit = 'payment.transaction'

    def _get_specific_rendering_values(self, processing_values):
        """ Override of `payment` to return PhonePe-specific rendering values.

        Note: self.ensure_one() from `_get_processing_values`

        :param dict processing_values: The generic and specific processing values of the transaction.
        :return: The dict of provider-specific rendering values.
        :rtype: dict
        """
        res = super()._get_specific_rendering_values(processing_values)
        if self.provider_code != 'phonepe':
            return res
        base_url = self.provider_id.get_base_url()
        return_url_params = {'reference': self.reference}
        # Initiate the payment
        converted_amount = payment_utils.to_minor_currency_units(self.amount, self.currency_id)

        payment_provider = self.env['payment.provider'].sudo().search(
            [('code', '=', 'phonepe')], limit=1
        )
        if not payment_provider:
            _logger.warning("PhonePe configuration not found")
            return res
        # breakpoint()
        unique_transaction_id = str(uuid.uuid4())
        unique_user_id = '1'
        redirect_url =  self.env.user.get_base_url()
        payload = {
            "merchantId": payment_provider.phonepe_merchant_id,
            "merchantTransactionId": unique_transaction_id,
            "merchantUserId": unique_user_id,  
            "amount": converted_amount,
            "redirectUrl": url_join(
                base_url, f'{PhonePeController._return_url}?{url_encode(return_url_params)}'
            ),
            "callbackUrl": url_join(
                base_url, PhonePeController._callback_url
            ),
            "redirectMode": "POST",
            "paymentInstrument": {
                "type": "PAY_PAGE"
            }
        }
        response = self.provider_id._phonepe_make_request(endpoint='pg/v1/pay', payload=payload)
        # breakpoint()
        rendering_values = {
            'api_url' : response['data']['instrumentResponse']['redirectInfo']['url'],
        }
        return rendering_values
