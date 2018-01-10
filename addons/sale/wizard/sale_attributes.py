# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.


from odoo import api, fields, models, _
from odoo.exceptions import ValidationError

class SaleAttributes(models.TransientModel):
    _name = "sale.attributes"
    _description = "Sale Attributes"
    _rec_name = "product_tmpl_id"

    sale_order_line_id = fields.Many2one('sale.order.line', string="Order Line", ondelete='cascade', index=True, copy=False)
    product_tmpl_id = fields.Many2one('product.template', string="Product", domain=[('attribute_line_ids', '!=', False)])
    sale_attribute_lines = fields.One2many('sale.attribute.lines', 'sale_attributes_id')
    price_extra = fields.Float(compute="_compute_price_extra", string="Price Extra")

    @api.constrains("sale_attribute_lines")
    def _check_sale_attribute_lines(self):
        if len(self.product_tmpl_id.product_variant_ids) > 1:
            variant_attribute_ids = [ variant.attribute_value_ids.sorted(key=lambda r: r.id).ids for variant in self.product_tmpl_id.product_variant_ids]
            sale_attribute_Values = self.sale_attribute_lines.mapped('value_id').sorted(key=lambda r: r.id)
            if sale_attribute_Values.filtered(lambda r: r.attribute_id.create_variant).ids not in variant_attribute_ids:
                raise ValidationError(_("Error ! This combination does not exist!!."))

    @api.onchange('product_tmpl_id')
    def _onchange_product_tmpl_id(self):
        if self.product_tmpl_id:
            attr_lines = []
            for attribute_line in self.product_tmpl_id.attribute_line_ids:
                attr_lines.append((0, 0, {'attribute_id':  attribute_line.attribute_id.id}))
            self.sale_attribute_lines = attr_lines

    @api.depends('sale_attribute_lines.value_id.price_ids')
    def _compute_price_extra(self):
        for sale_attribute in self:
            price_extra = 0.0
            for attribute_price in sale_attribute.sale_attribute_lines.mapped('value_id.price_ids'):
                if attribute_price.product_tmpl_id.id == sale_attribute.product_tmpl_id.id:
                    price_extra += attribute_price.price_extra
            sale_attribute.price_extra = price_extra

    def create_order_lines(self):
        for sale_attribute in self:
            if len(sale_attribute.product_tmpl_id.product_variant_ids) == 1:
                attribute_values = [ value_id for value_id in sale_attribute.sale_attribute_lines.mapped('value_id')]
                name = self.env['sale.order.line']._get_description_with_attribue_value(sale_attribute.product_tmpl_id.product_variant_ids, attribute_values)
                sale_attribute.sale_order_line_id = self.env['sale.order.line'].with_context(price_extra=sale_attribute.price_extra).create({
                        'order_id': self.env.context.get('active_id'),
                        'name': name,
                        'product_id': sale_attribute.product_tmpl_id.product_variant_ids.id
                })
            else:
                for variant in sale_attribute.product_tmpl_id.product_variant_ids:
                    attribute_values = [ value_id for value_id in variant.attribute_value_ids]
                    if sale_attribute.sale_attribute_lines.mapped('value_id').ids == sorted(variant.attribute_value_ids.ids):
                        name = self.env['sale.order.line']._get_description_with_attribue_value(variant, attribute_values)
                        sale_attribute.sale_order_line_id = self.env['sale.order.line'].create({
                                'order_id': self.env.context.get('active_id'),
                                'name': name,
                                'product_id': variant.id
                        })
                    else:
                        matched_variant_attributes =  sale_attribute.sale_attribute_lines.mapped('value_id') & variant.attribute_value_ids
                        subscracted_variant_attributes = sale_attribute.sale_attribute_lines.mapped('value_id') - variant.attribute_value_ids
                        if matched_variant_attributes.ids == variant.attribute_value_ids.ids:
                            name = self.env['sale.order.line']._get_description_with_attribue_value(variant, subscracted_variant_attributes)
                            sale_attribute.sale_order_line_id = self.env['sale.order.line'].create({
                                'order_id': self.env.context.get('active_id'),
                                'name': name,
                                'product_id': variant.id
                            })

class AttributeLines(models.TransientModel):
    _name = "sale.attribute.lines"
    _description = "Sale Attribute lines"

    sale_attributes_id = fields.Many2one('sale.attributes', 'Sale Attribute', ondelete='cascade', required=True)
    attribute_id = fields.Many2one('product.attribute', 'Attribute', ondelete='restrict')
    value_id = fields.Many2one('product.attribute.value', string='Attribute Values')