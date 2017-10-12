# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from ast import literal_eval

from odoo import fields, models, api, _
from odoo.exceptions import ValidationError


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

    @api.multi
    def validate_custom_val(self, val):
        self.ensure_one()
        #check if required fields are correctly set or not
        if self.is_required and not val:
            raise ValidationError(_("Custom value for '%s' must be required" % (self.name)))

        if self.value_type in ('integer', 'float') and val:
            min_val = self.min_value
            max_val = self.max_value
            val = literal_eval(val)
            if min_val and max_val and (val < min_val or val > max_val):
                raise ValidationError(_("Custom value for '%s' must be between %s and %s" % (self.name, self.min_value, self.max_value)))
            elif min_val and val < min_val:
                raise ValidationError(_("Custom value for '%s' must be at least %s" % (self.name, self.min_value)))
            elif max_val and val > max_val:
                raise ValidationError(_("Custom value for '%s' must be lower than %s" % (self.name, self.max_value)))


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


class ProductAttributeValue(models.Model):
    _inherit = 'product.attribute.value'

    attribute_value_ids = fields.Many2many('product.attribute.value', 'product_attribute_value_rel', 'value_id', 'attribute_value_id', string="Attribute Values")

    @api.multi
    def validate_combination_availability(self, value_ids):
        for value in self.filtered(lambda v: v.attribute_value_ids and v.id in value_ids):
            if len(set(value.attribute_value_ids.ids).intersection(value_ids)) != 0:
                sub_msg = ""
                for v in value.attribute_value_ids:
                    sub_msg += "%s - %s, " % (v.attribute_id.name, v.name)
                msg = _("Following combination of variant is not exist \n %s - '%s' is not available with --> ( %s)") % (value.attribute_id.name, value.name, sub_msg)
                raise ValidationError(msg)
