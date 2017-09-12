# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api


class ProductAttribute(models.Model):
    _inherit = "product.attribute"

    type = fields.Selection(selection_add=[('custom', 'Custom Value')])
    value_type = fields.Selection([
        ('char', 'Char'),
        ('integer', 'Integer'),
        ('float', 'Float'),
        ('textarea', 'Text Area'),
        ('color', 'Color'),
        ('attachment', 'Attachment'),
        ('date', 'Date'),
        ('datetime', 'DateTime')], default='char')

    char_custom = fields.Char(string="Custom Char")
    textarea_custom = fields.Text(string="Custom Text")
    integer_custom = fields.Integer('Custom Integer', default=0)
    attachment_custom = fields.Binary(string="Attachment")
    date_custom = fields.Date(string="Custom Date", default=fields.Date.context_today, required=True)
    datetime_custom = fields.Datetime(string="Custom DateTime", default=fields.Datetime.now, required=True)

    min_value = fields.Float(string="Minimum Value")
    max_value = fields.Float(string="Maximum Value")

    is_required = fields.Boolean(string="Required")

    @api.onchange('type')
    def onchange_type(self):
        if self.type == 'custom':
            self.create_variant = False
