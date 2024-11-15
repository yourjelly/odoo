# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import api, models, _


class AccountMoveSendWizard(models.TransientModel):
    _inherit = 'account.move.send.wizard'

    # -------------------------------------------------------------------------
    # DEFAULTS
    # -------------------------------------------------------------------------

    @api.model
    def default_get(self, fields_list):
        # EXTENDS 'account'
        results = super().default_get(fields_list)
        if move_id := results.get('move_id'):
            # TODO @las not sure it's the best place to do that, but do it in the new/create() seems even worse ?
            move = self.env['account.move'].browse(move_id)
            move.partner_id.commercial_partner_id.button_account_peppol_check_partner_endpoint()
        return results

    def _compute_sending_method_checkboxes(self):
        # EXTENDS 'account'
        super()._compute_sending_method_checkboxes()
        for wizard in self:
            peppol_partner = wizard.move_id.partner_id.commercial_partner_id
            if peppol_partner.with_company(wizard.company_id).peppol_verification_state == 'not_valid' \
                and (peppol_checkbox := wizard.sending_method_checkboxes.get('peppol')):
                peppol_checkbox.update({
                    'label': _('%s (customer not on Peppol)', peppol_checkbox['label']),
                    'disabled': True,
                })

    def action_send_and_print(self, allow_fallback_pdf=False):
        # EXTENDS 'account'
        self.ensure_one()
        if self.sending_methods and 'peppol' in self.sending_methods:
            if registration_action := self._do_peppol_pre_send(self.move_id):
                return registration_action
        return super().action_send_and_print(allow_fallback_pdf=allow_fallback_pdf)
