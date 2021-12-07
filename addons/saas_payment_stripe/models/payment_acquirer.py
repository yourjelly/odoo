
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging

from odoo import _, fields, models
from odoo.exceptions import UserError, ValidationError
# from odoo.addons.saas_worker.const import STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY

_logger = logging.getLogger(__name__)


class PaymentAcquirer(models.Model):
    _inherit = 'payment.acquirer'

    stripe_account_id = fields.Char(readonly=True, copy=False, required_if_provider='stripe')
    stripe_account_validated = fields.Boolean(default=False)

    def _check_required_if_provider(self):
        """ Check that acquirer-specific required fields have been filled.

        The fields that have the `required_if_provider="<provider>"` attribute are made required
        for all payment.acquirer records with the `provider` field equal to <provider> and with the
        `state` field equal to 'enabled' or 'test'.
        Acquirer-specific views should make the form fields required under the same conditions.

        :return: None
        :raise ValidationError: if an acquirer-specific required field is empty
        """
        stripe_acquirer = self.filtered(lambda acq: acq.provider == 'stripe')
        if self - stripe_acquirer:
            super(PaymentAcquirer, self - stripe_acquirer)
        if not stripe_acquirer:
            return
        field_names = []
        fields_stripe = dict()
        enabled_acquirers = stripe_acquirer.filtered(lambda acq: acq.state in ['enabled', 'test'])
        for name, field in self._fields.items():
            required_provider = getattr(field, 'required_if_provider', None)
            if required_provider == 'stripe' and any(
                required_provider == acquirer.provider and not acquirer[name]
                for acquirer in enabled_acquirers
            ):
                ir_field = self.env['ir.model.fields']._get(self._name, name)
                field_names.append(ir_field.field_description)
                fields_stripe[name] = ir_field.field_description
        if all(field in fields_stripe for field in ['stripe_publishable_key', 'stripe_secret_key']) and 'stripe_account_id' not in fields_stripe:
            field_names.remove(fields_stripe['stripe_publishable_key'])
            field_names.remove(fields_stripe['stripe_secret_key'])
        if all(field not in fields_stripe for field in ['stripe_publishable_key', 'stripe_secret_key']) and 'stripe_account_id' in fields_stripe:
            field_names.remove(fields_stripe['stripe_account_id'])
        if field_names:
            raise ValidationError(
                _("The following fields must be filled: %s", ", ".join(field_names))
            )

    def _update_stripe_onboarding_status(self):
        self.ensure_one()
        if self.provider != 'stripe':
            raise NotImplementedError(_('This method can only be used on Stripe provider'))

        account_details = self._stripe_make_request(f'accounts/{self.stripe_account_id}')
        if account_details.get('charges_enabled'):
            self.stripe_account_validated = True

    def _stripe_onboarding_account(self):
        self.ensure_one()
        if self.provider != 'stripe':
            raise NotImplementedError(_('This method can only be used on Stripe provider'))

        if not self.stripe_account_id:
            account = self._stripe_make_request('accounts', payload={'type': 'standard'})
            self.stripe_account_id = account.get('id')
        account_links = self._stripe_make_request('account_links', payload={
            'account': self.stripe_account_id,
            'return_url': self.env.company.get_base_url() + '/payment/stripe/onboarding/return',
            'refresh_url': self.env.company.get_base_url() + '/payment/stripe/onboarding/refresh',
            'type': 'account_onboarding',
        })
        return account_links.get('url')

    def action_stripe_onboarding_account(self):
        stripe_onboarding_url = self._stripe_onboarding_account()
        if not stripe_onboarding_url:
            raise UserError(_("Unable to create a Stripe Account directly from your instance for the moment. Please create one from Stripe Website"))
        return {
            'type': 'ir.actions.act_url',
            'url': stripe_onboarding_url,
            'target': 'self',
        }

    def _get_stripe_secret_key(self):
        # return STRIPE_SECRET_KEY (for saas)
        return self.env['ir.config_parameter'].sudo().get_param('saas_payment_stripe.stripe_secret_key')

    def _additional_header(self, endpoint):
        if not self.stripe_account_id or endpoint.startswith('account'):
            return {}
        else:
            return {'Stripe-Account': self.stripe_account_id}
