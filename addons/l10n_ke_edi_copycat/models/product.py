# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.


from odoo import api, fields, models


class ProductTemplate(models.Model):
    _inherit = "product.template"

    l10n_ke_hs_code = fields.Char(
        string='HS code',
        related='product_variant_ids.l10n_ke_hs_code',
        help="Product code needed in case of not 16%. ",
        readonly=False,
    )
    l10n_ke_hs_description = fields.Char(
        string='HS description',
        related='product_variant_ids.l10n_ke_hs_description',
        help="Product code description needed in case of not 16%. ",
        readonly=False,
    )

class ProductProduct(models.Model):
    _inherit = "product.product"

    l10n_ke_hs_code = fields.Char(
        string='HS code',
        help="Product code needed in case of not 16%. ",
    )
    l10n_ke_hs_description = fields.Char(
        string='HS description',
        help="Product code description needed in case of not 16%. ",
    )
