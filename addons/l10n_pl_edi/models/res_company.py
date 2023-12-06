from odoo import fields, models


class ResCompany(models.Model):
    _inherit = 'res.company'

    l10n_pl_edi_ksef_token = fields.Char(
        string='KSeF token',
        help='The token used to allow Odoo to fetch and post documents',
        groups='base.group_system')  # TODO documentation
