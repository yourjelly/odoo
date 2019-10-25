from odoo import fields, models


class ResBank(models.Model):
    _inherit = 'res.bank'

    l10n_il_branch_number = fields.Char(string='Branch Number')
