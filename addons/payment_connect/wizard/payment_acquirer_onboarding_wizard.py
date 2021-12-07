# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _, api, fields, models
from odoo.exceptions import UserError


class PaymentWizard(models.TransientModel):
    _inherit = 'payment.acquirer.onboarding.wizard'

    payment_method = fields.Selection(selection_add=[
        ('stripe', "Credit & Debit Card with Stripe (Visa, Mastercard, Google Pay, ...)"),
    ])

    def add_payment_methods(self):
        """ Install required payment acquiers, configure them and mark the
            onboarding step as done."""

        if self.payment_method == 'stripe' and not self.stripe_secret_key and not self.stripe_publishable_key:
            stripe_onboarding = True
        else:
            stripe_onboarding = False

        result = super().add_payment_methods()

        if stripe_onboarding:
            # create a new env including the freshly installed module(s)
            new_env = api.Environment(self.env.cr, self.env.uid, self.env.context)
            return self._onboarding_stripe(new_env)
        return result

    def _init_stripe(self, env):
        if self.stripe_secret_key and self.stripe_publishable_key:
            env.ref('payment.payment_acquirer_stripe').write({
                'stripe_secret_key': self.stripe_secret_key,
                'stripe_publishable_key': self.stripe_publishable_key,
                'state': 'enabled',
            })
        else:
            env.ref('payment.payment_acquirer_stripe').write({
                'journal_id': self.env['account.journal'].search([
                    ('type', '=', 'bank'), ('company_id', '=', env.company.id)
                ], limit=1).id,
            })

    def _onboarding_stripe(self, new_env):
        stripe_acquirer = new_env.ref('payment.payment_acquirer_stripe')
        stripe_onboarding_url = stripe_acquirer._stripe_onboarding_account()
        if stripe_onboarding_url:
            return {
                'type': 'ir.actions.act_url',
                'url': stripe_onboarding_url,
                'target': 'self',
            }

        action = self.env["ir.actions.actions"]._for_xml_id("payment.action_payment_acquirer")
        action.update({
            'views': [[False, 'form']],
            'res_id': stripe_acquirer.id,
        })
        return action
