# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class ResCompany(models.Model):
    _inherit = 'res.company'

    sale_header = fields.Binary('Quotation PDF Header')
    sale_footer = fields.Binary('Quotation PDF Footer')
