# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class PaymentToken(models.Model):
    _inherit = 'payment.token'

    def _get_available_tokens(self, providers_ids, partner_id, **kwargs):
        "Override of `payment` to remove token from being used anywhere else other then reccuring payments."
        all_tokens = super()._get_available_tokens(providers_ids, partner_id, **kwargs)

        return all_tokens.filtered(lambda token: token.provider_code != 'razorpay')
