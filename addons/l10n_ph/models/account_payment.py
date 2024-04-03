# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _, models, api
from odoo.exceptions import UserError


class AccountPayment(models.Model):
    _inherit = "account.payment"

    def action_open_l10n_ph_2307_wizard(self):
        self.ensure_one()
        if self.payment_type == 'outbound':
            wizard_action = self.env["ir.actions.act_window"]._for_xml_id("l10n_ph.view_l10n_ph_2307_wizard_act_window")
            wizard_action.update({
                'context': {'default_moves_to_export': self.reconciled_bill_ids.ids}
            })
            return wizard_action
        else:
            raise UserError(_('Only Outbound Payment is available.'))

    @api.depends('payment_type', 'journal_id')
    def _compute_payment_method_line_id(self):
        # OVERRIDE account to be able to set checks by default in the new view.
        super()._compute_payment_method_line_id()
        is_check_payment = self.env.context.get('is_check_payment')
        if is_check_payment:
            for record in self:
                method_line = record.journal_id.outbound_payment_method_line_ids.filtered(
                    lambda l: l.payment_method_id.code == 'check_printing'
                )
                if record.payment_type == 'outbound' and method_line:
                    record.payment_method_line_id = method_line[0]

