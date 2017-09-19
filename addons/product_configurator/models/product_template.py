# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models

class ProductTemplate(models.Model):

    _inherit = "product.template"

    variant_type = fields.Selection(
        [('standard', 'Standard'), ('configurable', 'Configurable')], default='standard',
        help="Standard variants are generated upfront so that you can manage them in your inventory.\n"
        "Configurable variants are generated at the sales when the product is added")

    @api.multi
    def create_variant_ids(self):
        """ Prevent configurable products from creating variants as these serve
            only as a template for the product configurator"""
        templates = self.filtered(lambda t: not t.variant_type == 'configurable')
        if not templates:
            return None
        return super(ProductTemplate, templates).create_variant_ids()


class ProductProduct(models.Model):

    _inherit = 'product.product'

    custom_value_ids = fields.One2many('product.attribute.value.custom', 'product_id', string='Custom Values', readonly=True)
