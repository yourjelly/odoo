from odoo import models, fields


class ResCountry(models.Model):
    _inherit = 'res.country'

    l10n_tr_country_code = fields.Integer(string="TC GIB Country Code")
