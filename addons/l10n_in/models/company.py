from odoo import api, fields, models

class ResCompany(models.Model):
    _inherit = 'res.company'

    l10n_in_upi_id = fields.Char(string="UPI Id")
    l10n_in_edi_production_env = fields.Boolean(
        string="E-invoice (IN) Is production OSE environment",
        help="Enable the use of production credentials",
        groups="base.group_system",
    )
