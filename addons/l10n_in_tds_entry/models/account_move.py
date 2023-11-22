# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields


class AccountMove(models.Model):
    _inherit = "account.move"

    l10n_in_is_tds = fields.Boolean(string="Is TDS Entry")

    # technical field to show tds entry button on invoice
    l10n_in_show_tds_entry_button = fields.Boolean(string="Show TDS Entry Button", compute="_compute_l10n_in_show_tds_entry_button")

    def _compute_payments_widget_reconciled_info(self):
        super()._compute_payments_widget_reconciled_info()
        for move in self:
            invoice_payments_widget = move.invoice_payments_widget or {}
            for reconciled_val in invoice_payments_widget.get('content', []):
                reconciled_move_id = reconciled_val.get('move_id')
                if reconciled_move_id:
                    reconciled_move = self.browse(reconciled_move_id)
                    reconciled_val['l10n_in_is_tds'] = reconciled_move.l10n_in_is_tds

    def _compute_l10n_in_show_tds_entry_button(self):
        for move in self:
            move.l10n_in_show_tds_entry_button = False
            if move.country_code == 'IN' and move.move_type == 'in_invoice' and move.state == 'posted' and move.payment_state != 'in_payment':
                # show tds entry button if no tds entry exists
                move.l10n_in_show_tds_entry_button = not bool(move.invoice_payments_widget and any(c.get('l10n_in_is_tds') for c in move.invoice_payments_widget.get('content',{})) or False)
