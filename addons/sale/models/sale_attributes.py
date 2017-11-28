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
        if 'sale_attribute_lines' in fields:
            sale_attribute_lines = []
            if self.env.context.get('default_product_id'):
                product = self.env['product.product'].browse(self.env.context['default_product_id'])
                for attribute_line in product.product_tmpl_id.attribute_line_ids.filtered(lambda l: not l.attribute_id.create_variant):
                    sale_attribute_lines.append((0, 0, {'attribute_id':  attribute_line.attribute_id.id}))
            result['sale_attribute_lines'] = sale_attribute_lines
        return result

    sale_order_line_id = fields.Many2one('sale.order.line', string="Order Line", ondelete='cascade', index=True, copy=False)
    product_id = fields.Many2one('product.product', string="Product")
    sale_attribute_lines = fields.One2many('sale.attribute.lines', 'sale_attributes_id')
    price_extra = fields.Float(compute="_compute_price_extra", string="Price Extra")

    @api.depends('sale_attribute_lines.attribute_value_line_id.price_extra')
    def _compute_price_extra(self):
        for sale_attributes in self:
            price_extra = 0.0
            for attribute_line in sale_attributes.sale_attribute_lines.mapped('attribute_value_line_id'):
                price_extra += attribute_line.price_extra
            sale_attributes.price_extra = price_extra

    @api.constrains("sale_attribute_lines")
    def _check_sale_attribute_lines(self):
        excluded_attribute_value_ids = self.mapped('sale_attribute_lines.attribute_value_line_id.excluded_value_ids').ids
        if any(value.id in excluded_attribute_value_ids for value in self.mapped('sale_attribute_lines.attribute_value_line_id.value_id')):
            raise ValidationError(_("Error ! this attribute value cannot be use with the following value."))


class AttributeLines(models.Model):
    _name = "sale.attribute.lines"
    _description = "Sale Attribute lines"

    sale_attributes_id = fields.Many2one('sale.attributes', 'Attribute', ondelete='cascade', required=True)
    attribute_id = fields.Many2one('product.attribute', 'Attribute', ondelete='restrict')
    attribute_value_line_id = fields.Many2one('product.attribute.value.line', string='Attribute Values')
    product_tmpl_id = fields.Many2one(related="sale_attributes_id.product_id.product_tmpl_id", relation="product.template", string="Produt Template")
