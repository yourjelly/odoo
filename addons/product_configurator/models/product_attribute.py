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

    @api.onchange('type')
    def onchange_type(self):
        if self.type == 'custom':
            self.create_variant = False
