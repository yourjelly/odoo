# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class AdyenAccount(models.Model):
    _inherit = 'adyen.account'

    @api.model
    def _default_payment_journal_id(self):
        return self.env['account.journal'].search(
            [('company_id', '=', self.env.company.id), ('type', '=', 'bank')],
            limit=1
        )

    # Non stored UX field to ease onboarding by setting necessary journal on Odoo acquirer
    payment_journal_id = fields.Many2one(
        string="Payment Journal",
        help="The journal in which the successful transactions are posted",
        comodel_name='account.journal',
        domain="[('type', '=', 'bank'), ('company_id', '=', company_id)]",
        default=_default_payment_journal_id,
        required=True,
        store=False,
    )

    #=== COMPUTE METHODS ===#

    #=== CRUD METHODS ===#

    @api.model
    def create(self, vals):
        account = super().create(vals)

        if vals.get('payment_journal_id'):
            # Automatically set the journal from the account on the payment acquirer linked to this
            # account. If more than one payment acquirers are linked to this account, the journal
            # must be set manually for each of them.
            acquirer_sudo = self.env['payment.acquirer'].sudo().search(
                [('provider', '=', 'odoo'), ('company_id', '=', account.company_id.id)]
            )
            if len(acquirer_sudo) == 1:
                acquirer_sudo.journal_id = vals['payment_journal_id']

        return account

    def unlink(self):
        # Disable all payment acquirers linked to this account
        payment_acquirers = self.env['payment.acquirer'].search(
            [('provider', '=', 'odoo'), ('company_id.adyen_account_id', 'in', self.ids)]
        )
        payment_acquirers.state = 'disabled'
        return super().unlink()

    #=== BUSINESS METHODS ===#

    def _set_active(self):
        """ Override of odoo_payments to automatically enable the linked payment acquirer.

        If a payment acquirer linked to this account is found, it is also enabled to allow smooth
        onboarding. If more than one payment acquirers are linked to this account, they are left
        disabled and must be enabled manually.

        Note: sudoed environment
        Note: self.ensure_one()

        :return: None
        """
        super()._set_active()

        # Enable the linked payment acquirer
        payment_acquirer = self.env['payment.acquirer'].search(
            [('provider', '=', 'odoo'), ('company_id', '=', self.company_id.id)]
        )
        if len(payment_acquirer) == 1:
            if not payment_acquirer.journal_id:  # The acquirer is badly configured
                payment_acquirer.journal_id = self._default_payment_journal_id()  # Fix the journal
            payment_acquirer.state = 'enabled' if not self.is_test else 'test'

    def _set_closed(self):
        """ Override of odoo_payments to disabled all linked payment acquirers.

        All payment acquirers linked to this account are also disabled to prevent any transaction to
        be made. In practice, the proxy would prevent such transaction to reach Adyen's API.

        Note: sudoed environment
        Note: self.ensure_one()

        :return: None
        """
        super()._set_closed()

        # Disable all linked payment acquirers
        payment_acquirers = self.env['payment.acquirer'].search(
            [('provider', '=', 'odoo'), ('company_id', '=', self.company_id.id)]
        )
        if payment_acquirers:
            payment_acquirers.state = 'disabled'
