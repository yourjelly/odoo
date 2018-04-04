# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models, fields


class ProductTemplate(models.Model):
    _inherit = 'product.template'

    hsn_description = fields.Char(string="HSN/SAC Description", help="Harmonized System Nomenclature/Services Description")
    is_eligible_for_itc = fields.Boolean(string="Is eligible for ITC",  help="Check this box if this product is eligible for ITC(Input Tax Credit) under GST")
    is_asset = fields.Boolean(string="Is Asset", help="Check this box if this product is asset")
