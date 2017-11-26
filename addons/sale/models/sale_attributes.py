# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import ValidationError

class SaleAttributes(models.Model):
    _name = "sale.attributes"
    _description = "Sale Attributes"
    _rec_name = "product_id"

    @api.model
    def default_get(self, fields):
        result = super(SaleAttributes, self).default_get(fields)
        if 'attribute_lines' in fields:
            attr_lines = []
            if self.env.context.get('default_product_id'):
                product = self.env['product.product'].browse(self.env.context['default_product_id'])
                for attribute_line in product.product_tmpl_id.attribute_line_ids.filtered(lambda l: not l.attribute_id.create_variant):
                    attr_lines.append((0, 0, {'attribute_id':  attribute_line.attribute_id.id}))
            result['attribute_lines'] = attr_lines
        return result

    sale_order_line_id = fields.Many2one('sale.order.line', string="Order Line", ondelete='cascade', index=True, copy=False)
    product_id = fields.Many2one('product.product', string="Product")
    attribute_lines = fields.One2many('attribute.lines', 'sale_attributes_id')
    price_extra = fields.Float(compute="_compute_price_extra", string="Price Extra")

    @api.depends('attribute_lines.value_id.price_ids')
    def _compute_price_extra(self):
        for attributes in self:
            price_extra = 0.0
            for attribute_price in attributes.attribute_lines.mapped('value_id.price_ids'):
                if attribute_price.product_tmpl_id == attributes.product_id.product_tmpl_id:
                    price_extra += attribute_price.price_extra
            attributes.price_extra = price_extra

class AttributeLines(models.Model):
    _name = "attribute.lines"
    _description = "Sale Attribute lines"

    sale_attributes_id = fields.Many2one('sale.attributes', 'Attribute', ondelete='cascade', required=True)
    attribute_id = fields.Many2one('product.attribute', 'Attribute', ondelete='restrict')
    value_id = fields.Many2one('product.attribute.value', string='Attribute Values')
