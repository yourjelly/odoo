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
        templates = self.filtered(lambda t: not t.variant_type == 'configurable')
        if not templates:
            if self.env.context.get('create_from_tmpl'):
                self.env['product.product'].create({'product_tmpl_id': self.id})
            return None
        return super(ProductTemplate, templates).create_variant_ids()

    def validate_configuration(self, value_ids, custom_vals=None):
        for line in self.attribute_line_ids:
            # Validate custom values
            attr = line.attribute_id
            if attr.id in custom_vals:
                attr.validate_custom_val(custom_vals[attr.id]['value'])
            # check variant availability with specific combination
            attr.value_ids.validate_combination_availability(value_ids)
        return True

    def get_variant(self, value_ids, custom_values=None):

        self.validate_configuration(value_ids, custom_values)
        variant = self._find_variant_if_exist(value_ids, custom_values)
        if variant:
            return variant

        vals = self._prepare_variant_vals(value_ids, custom_values)
        variant = self.env['product.product'].create(vals)
        return variant

    def _prepare_variant_vals(self, value_ids, custom_values=None):
        vals = {
                'product_tmpl_id': self.id,
                'attribute_value_ids': [(4, v_id) for v_id in value_ids],
            }

        if custom_values:
            data = []
            for key, val in custom_values.items():
                if not val['value']:
                    continue

                if val['value_type'] != 'binary':
                    data.append((0, 0, {
                        'attribute_id': key,
                        'value': val['value']}))
                else:
                    data.append((0, 0, {
                        'attribute_id': key,
                        'value': '',
                        'attachment_ids': [(0, 0, self._get_attachment_value(val['value'], val['name']))]}))
            vals.update(custom_value_ids=data)

        return vals

    def _get_attachment_value(self, file, file_name):
        return {
            'name': file_name,
            'datas': file,
            'datas_fname': file_name,
        }

    def _find_variant_if_exist(self, value_ids, custom_values):
        for variant in self.product_variant_ids:
            # we don't find the variant if there is any custom values
            if (set(variant.attribute_value_ids.ids) == set(value_ids) and not custom_values):
                return variant
        return False


class ProductProduct(models.Model):
    _inherit = 'product.product'

    custom_value_ids = fields.One2many('product.attribute.value.custom', 'product_id', string='Custom Values', readonly=True)
