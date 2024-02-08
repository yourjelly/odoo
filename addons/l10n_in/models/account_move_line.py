from odoo import api, fields, models


class AccountMoveLine(models.Model):
    _inherit = "account.move.line"

    l10n_in_hsn_code = fields.Char(string="HSN/SAC Code", compute="_compute_l10n_in_hsn_code", store=True, readonly=False, copy=False)
    is_valid_l10n_in_hsn_code = fields.Boolean(compute="_compute_is_valid_l10n_in_hsn_code")

    @api.depends('product_id')
    def _compute_l10n_in_hsn_code(self):
        indian_lines = self.filtered(lambda line: line.company_id.account_fiscal_country_id.code == 'IN')
        (self - indian_lines).l10n_in_hsn_code = False
        for line in indian_lines:
            if line.product_id:
                line.l10n_in_hsn_code = line.product_id.l10n_in_hsn_code

    @api.depends('l10n_in_hsn_code', 'company_id.l10n_in_hsn_code_digit')
    def _compute_is_valid_l10n_in_hsn_code(self):
        indian_lines = self.filtered(lambda line: line.company_id.account_fiscal_country_id.code == 'IN')
        (self - indian_lines).is_valid_l10n_in_hsn_code = False
        for line in indian_lines:
            minimum_hsn_len = line.company_id or self.env.company
            check_hsn = line.tax_ids and line.l10n_in_hsn_code and minimum_hsn_len
            line.is_valid_l10n_in_hsn_code = check_hsn and len(line.l10n_in_hsn_code) < int(line.company_id.l10n_in_hsn_code_digit)
