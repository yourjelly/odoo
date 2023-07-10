# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _, models
from odoo.exceptions import UserError


class PaymentCaptureWizard(models.TransientModel):
    _inherit = 'payment.capture.wizard'

    def action_capture(self):
        for wizard in self:
            for source_tx in wizard.transaction_ids.filtered(lambda tx: tx.state == 'authorized'):
                if wizard.void_remaining_amount and source_tx.provider_code == 'asiapay':
                    raise UserError(_("You cannot void a transaction with a remaining amount to capture for Asiapay."))
        super().action_capture()
