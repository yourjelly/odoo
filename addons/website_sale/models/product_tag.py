# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models

class ProductTag(models.Model):
    _name = 'product.tag'
    _inherit = ['website.multi.mixin', 'product.tag']

    product_variant_image_ids = fields.One2many('product.image', 'product_variant_id', string="Extra Variant Images")
    ecommerce_visibility = fields.Boolean(default=True,
        help="By checking this field this tag will be displayed for users.")
    product_tag_image = fields.Image("Image", max_width=50, max_height=50)
