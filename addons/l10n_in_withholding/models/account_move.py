from odoo import api, models, fields


class AccountMove(models.Model):
    _inherit = "account.move"

    l10n_in_is_withholding = fields.Boolean("Is Withholding Entry")
    l10n_in_withholding_move_id = fields.Many2one(
        comodel_name='account.move',
        string="India Withholding Entry",
        readonly=True,
        copy=False,
        help="Link the withholding entry to the Invoice/Bill"
    )
    l10n_in_withholding_line_ids = fields.One2many('account.move.line', 'move_id',
        string="Indian Withholding Lines",
        compute='_compute_l10n_in_withholding_line_ids',
    )
    l10n_in_withhold_move_ids = fields.One2many('account.move', 'l10n_in_withholding_move_id',
        string="Indian Withholding Entries"
    )

    # === Compute Methods ===
    @api.depends('line_ids', 'l10n_in_is_withholding')
    def _compute_l10n_in_withholding_line_ids(self):
        # Compute the withholding lines for the move
        for move in self:
            if move.l10n_in_is_withholding:
                move.l10n_in_withholding_line_ids = move.line_ids.filtered('tax_ids')
            else:
                move.l10n_in_withholding_line_ids = False

    def _compute_payments_widget_reconciled_info(self):
        # Override to show 'Tds on' instead of 'Paid on' in invoice_payments_widget
        super()._compute_payments_widget_reconciled_info()
        for move in self:
            invoice_payments_widget = move.invoice_payments_widget or {}
            for reconciled_val in invoice_payments_widget.get('content', []):
                reconciled_move_id = reconciled_val.get('move_id')
                if reconciled_move_id:
                    reconciled_val['l10n_in_is_withholding'] = True

    def action_l10n_in_withholding_entries(self):
        self.ensure_one()
        return {
            'name': "Withholding Entries",
            'type': 'ir.actions.act_window',
            'res_model': 'account.move',
            'view_mode': 'tree,form',
            'domain': [('id', 'in', self.l10n_in_withhold_move_ids.ids)],
        }
