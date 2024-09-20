from odoo import fields, models, api


class AccountMoveLine(models.Model):
    _inherit = "account.move.line"

    l10n_in_withhold_tax_amount = fields.Monetary(string="TDS Tax Amount", compute='_compute_withhold_tax_amount')
    l10n_in_tds_tcs_section_id = fields.Many2one(related="account_id.l10n_in_tds_tcs_section_id")
    l10n_in_suggested_tds_tcs_section_id = fields.Many2one('l10n_in.section.alert', string="Suggested Section", compute='_compute_l10n_in_suggested_tds_tcs_section_id', store=True)

    @api.depends('tax_ids')
    def _compute_withhold_tax_amount(self):
        # Compute the withhold tax amount for the withholding lines
        withholding_lines = self.filtered('move_id.l10n_in_is_withholding')
        (self - withholding_lines).l10n_in_withhold_tax_amount = False
        for line in withholding_lines:
            line.l10n_in_withhold_tax_amount = line.currency_id.round(abs(line.price_total - line.price_subtotal))

    @api.depends('account_id', 'price_total', 'move_id.partner_id')
    def _compute_l10n_in_suggested_tds_tcs_section_id(self):
        for move in self.move_id:
            sections = move._get_l10n_in_tds_tcs_applicable_sections() or []  # Ensure sections is an iterable
            for section in sections:
                if section.tax_source_type == 'tds':
                    applicable_lines = move.invoice_line_ids.filtered(lambda line: line.l10n_in_tds_tcs_section_id in sections)
                elif section.tax_source_type == 'tcs':
                    applicable_lines = move._get_tcs_applicable_lines(move.invoice_line_ids)
                applicable_lines.l10n_in_suggested_tds_tcs_section_id = section
