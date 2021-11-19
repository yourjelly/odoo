# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models

class PaymentWizard(models.TransientModel):
    """ Override for the sale quotation onboarding panel. """
    _name = 'sale.payment.acquirer.onboarding.wizard'
    _inherit = 'payment.acquirer.onboarding.wizard'
    _description = 'Sale Payment acquirer onboarding wizard'

    @api.model
    def _selection_payment_methods(self):
        base_methods = [
            ('manual', "Custom payment instructions (i.e Wire Transfer)"),
            ('digital_signature', "Electronic signature"),
        ]
        if not self.env.company.is_odoo_payment_available():
            return base_methods
        return [('odoo', "Payment with Debit/Credit card with Odoo payment")] + base_methods

    @api.model
    def _default_payment_method(self):

        country = self.env.company.country_id
        return 'digital_signature' if not self.env.company.is_odoo_payment_available() else 'odoo'

    def _set_payment_acquirer_onboarding_step_done(self):
        """ Override. """
        self.env.company.sudo().set_onboarding_step_done('sale_onboarding_order_confirmation_state')

    def add_payment_methods(self):
        self.env.company.sale_onboarding_payment_method = self.payment_method
        if self.payment_method == 'digital_signature':
            self.env.company.portal_confirmation_sign = True
        elif self.payment_method in ('odoo', 'manual', 'stripe', 'paypal'):
            self.env.company.portal_confirmation_pay = True

        return super().add_payment_methods()
