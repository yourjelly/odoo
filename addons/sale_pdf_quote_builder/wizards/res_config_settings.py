# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    header = fields.Binary(related='company_id.header', readonly=False)
    footer = fields.Binary(related='company_id.footer', readonly=False)
