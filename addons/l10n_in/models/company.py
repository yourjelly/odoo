from odoo import api, fields, models

class ResCompany(models.Model):
    _inherit = 'res.company'

    l10n_in_upi_id = fields.Char(string="UPI Id")
    l10n_in_hsn_code_digit = fields.Selection(
        selection=[
            ("4", "4 Digits"),
            ("6", "6 Digits"),
            ("8", "8 Digits"),
        ],
        string="HSN Code Digit",
        compute="_compute_l10n_in_hsn_code_digit",
        store=True,
        readonly=False,
    )

    @api.depends('vat')
    def _compute_l10n_in_hsn_code_digit(self):
        for record in self:
            if record.vat:
                record.l10n_in_hsn_code_digit = "4"
            else:
                record.l10n_in_hsn_code_digit = False
