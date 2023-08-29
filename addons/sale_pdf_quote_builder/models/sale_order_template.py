# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class SaleOrderTemplate(models.Model):
    _inherit = 'sale.order.template'

    header = fields.Binary()
    footer = fields.Binary()
