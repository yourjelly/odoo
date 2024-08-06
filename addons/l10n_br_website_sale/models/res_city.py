# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import models, fields


class ResCity(models.Model):
    _inherit = 'res.city'

    l10n_br_zip_ranges = fields.Char("Zip Ranges", readonly=True, help="Brazil: technical field that maps a city to one or more zip code ranges.")
