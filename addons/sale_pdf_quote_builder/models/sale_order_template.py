# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class SaleOrderTemplate(models.Model):
    _inherit = 'sale.order.template'

    sale_header = fields.Binary(string="Quotation PDF Header")
    sale_footer = fields.Binary(string="Quotation PDF Footer")
