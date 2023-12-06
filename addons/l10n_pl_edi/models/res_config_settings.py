from odoo import fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    l10n_pl_edi_ksef_token = fields.Char(related='company_id.l10n_pl_edi_ksef_token', readonly=False)
