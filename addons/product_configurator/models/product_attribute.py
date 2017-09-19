# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api


class ProductAttribute(models.Model):
    _inherit = "product.attribute"

    CUSTOM_TYPES = [
        ('char', 'Char'),
        ('integer', 'Integer'),
        ('float', 'Float'),
        ('text', 'Textarea'),
        ('color', 'Color'),
        ('binary', 'Attachment'),
        ('date', 'Date'),
        ('datetime', 'DateTime'),
    ]

    type = fields.Selection(selection_add=[('custom', 'Custom Value')])
    value_type = fields.Selection(selection=CUSTOM_TYPES, default='char')

    min_value = fields.Float(string="Minimum Value")
    max_value = fields.Float(string="Maximum Value")

    is_required = fields.Boolean(string="Required")
    uom_id = fields.Many2one('product.uom', string='Unit of Measure')

    @api.onchange('type')
    def onchange_type(self):
        if self.type == 'custom':
            self.create_variant = False


class ProductAttributeValueCustom(models.Model):

    _name = 'product.attribute.value.custom'

    @api.multi
    @api.depends('attribute_id', 'attribute_id.uom_id')
    def _compute_val_name(self):
        for attr_val_custom in self:
            uom = attr_val_custom.attribute_id.uom_id.name
            attr_val_custom.name = '%s%s' % (attr_val_custom.value, uom or '')

    name = fields.Char(compute="_compute_val_name", string='Name', readonly=True, store=True)
    product_id = fields.Many2one('product.product', string='Product ID', required=True, ondelete='cascade')
    attribute_id = fields.Many2one('product.attribute', string='Attribute', required=True)
    attachment_ids = fields.One2many('ir.attachment', 'res_id', string='Attachments')
    value = fields.Char(string='Custom Value')

    _sql_constraints = [
        ('attr_uniq', 'unique(product_id, attribute_id)',
         'Cannot have two custom values for the same attribute')
    ]


class ProductAttributeLine(models.Model):

    _inherit = 'product.attribute.line'

    _order = 'sequence'

    is_custom_attr = fields.Boolean(compute='_is_custom_attribute', string="Is Custom Attribute")
    sequence = fields.Integer(string='Sequence', default=10)

    @api.multi
    @api.depends('attribute_id')
    def _is_custom_attribute(self):
        for line in self.filtered(lambda l: l.attribute_id.type == 'custom'):
            line.is_custom_attr = True
