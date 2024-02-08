# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models, fields, _
from odoo.exceptions import ValidationError


class ProductTemplate(models.Model):
    _inherit = 'product.template'

    l10n_in_hsn_code = fields.Char(string="HSN/SAC Code", help="Harmonized System Nomenclature/Services Accounting Code")
    l10n_in_hsn_description = fields.Char(string="HSN/SAC Description", help="HSN/SAC description is required if HSN/SAC code is not provided.")
