# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    sale_header = fields.Binary(related='company_id.sale_header', readonly=False, string="Quotation PDF Header")
    sale_footer = fields.Binary(related='company_id.sale_footer', readonly=False, string="Quotation PDF Footer")
