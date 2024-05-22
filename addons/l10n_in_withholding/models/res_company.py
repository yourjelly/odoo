from odoo import fields, models


class ResCompany(models.Model):
    _inherit = 'res.company'

    l10n_in_withholding_account_id = fields.Many2one(
        comodel_name='account.account',
        string="Withholding Account",
    )
    l10n_in_withholding_journal_id = fields.Many2one(
        comodel_name='account.journal',
        string="Withholding Journal",
    )
