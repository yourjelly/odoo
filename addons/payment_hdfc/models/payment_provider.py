# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging

from odoo import fields, models

from odoo.addons.payment_hdfc import const


_logger = logging.getLogger(__name__)

class PaymentProvider(models.Model):
    _inherit = 'payment.provider'

    code = fields.Selection(selection_add=[('hdfc', 'HDFC')], ondelete={'hdfc': 'set default'})
    hdfc_merchant_id = fields.Char(string='HDFC Merchant ID', required_if_provider='hdfc', groups='base.group_user')
    hdfc_access_code = fields.Char(string='HDFC Access Code', required_if_provider='hdfc', groups='base.group_user')
    hdfc_working_key = fields.Char(string='HDFC Working Key', required_if_provider='hdfc', groups='base.group_user')

    def _hdfc_get_api_url(self):
        """ Return the URL of the API corresponding to the provider's state.

        :return: The API URL.
        :rtype: str
        """
        self.ensure_one()
        environment = 'production' if self.state == 'enabled' else 'test'
        api_url = const.API_URLS[environment]
        return api_url

    def _get_supported_currencies(self):
        """ Override of `payment` to return the supported currencies. """
        supported_currencies = super()._get_supported_currencies()
        if self.code == 'hdfc':
            supported_currencies = supported_currencies.filtered(
                lambda c: c.name in const.SUPPORTED_CURRENCIES
            )
        return supported_currencies
