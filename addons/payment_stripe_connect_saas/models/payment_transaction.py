# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging

from odoo import models

# from odoo.addons.saas_worker.const import STRIPE_PUBLISHABLE_KEY

_logger = logging.getLogger(__name__)


class PaymentTransaction(models.Model):
    _inherit = 'payment.transaction'

    def _get_specific_processing_values(self, processing_values):
        """ Override of payment to return Stripe-specific processing values.

        Note: self.ensure_one() from `_get_processing_values`

        :param dict processing_values: The generic processing values of the transaction
        :return: The dict of acquirer-specific processing values
        :rtype: dict
        """
        res = super()._get_specific_processing_values(processing_values)
        if self.provider != 'stripe' or self.operation == 'online_token' or res.get('publishable_key'):
            return res

        # res['publishable_key'] = STRIPE_PUBLISHABLE_KEY
        res['publishable_key'] = self.env['ir.config_parameter'].sudo().get_param('saas_payment_stripe.stripe_publishable_key')
        res['stripe_account'] = self.acquirer_id.stripe_account_id
        return res
