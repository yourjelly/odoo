# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields


class ProductTemplate(models.Model):
    _inherit = 'product.template'

    hsn_description = fields.Char(string="HSN/SAC Description", help="Harmonized System Nomenclature/Services Description")
