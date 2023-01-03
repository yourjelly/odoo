# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import fields, models


class ProductTemplate(models.Model):
    _inherit = "product.template"

    product_hs_code = fields.Many2one('product.hs.code', string="HS code")
