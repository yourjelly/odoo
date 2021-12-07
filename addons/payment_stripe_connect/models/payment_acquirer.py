
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging

from odoo import _, models

_logger = logging.getLogger(__name__)


class PaymentAcquirer(models.Model):
    _inherit = 'payment.acquirer'

    def _stripe_onboarding_account(self):
        self.ensure_one()
        if self.provider != 'stripe':
            raise NotImplementedError(_('This method can only be used on Stripe provider'))
        return ''

    def action_stripe_onboarding_account(self):
        return {}
