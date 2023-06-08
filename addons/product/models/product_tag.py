# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from random import randint

from odoo import api, fields, models
from odoo.osv import expression

class ProductTag(models.Model):
    _name = 'product.tag'
    _description = 'Product Tag'

    name = fields.Char('Tag Name', required=True, translate=True)
    color = fields.Char('Color')

    def _get_default_ids(self):
        pt_id = self.env.context.get('product_template_id')
        product_template = self.env['product.template'].browse(pt_id)
        return product_template.product_variant_ids

    product_ids = fields.Many2many(
        'product.product',
        'product_tag_product_product_rel',
        string="All Product Variants using this Tag",
        default=_get_default_ids)

    _sql_constraints = [
        ('name_uniq', 'unique (name)', "Tag name already exists!"),
    ]
