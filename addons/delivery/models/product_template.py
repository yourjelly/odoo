# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields


class ProductTemplate(models.Model):
    _inherit = 'product.template'

    hs_code = fields.Char(
        string="HS Code",
        help="Standardized code for international shipping and goods declaration. At the moment, only used for the FedEx shipping provider.",
    )
    hide_hs_code = fields.Boolean(compute='_compute_hide_hs_code')

    def _compute_hide_hs_code(self):
        display_product_variant_view = self.env.context.get('display_product_variant_view')
        for template in self:
            if display_product_variant_view or template.product_variant_count == 1:
                template.hide_hs_code = False
            else:
                template.hide_hs_code = True
