# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import json

from odoo import api, fields, models, _
from odoo.exceptions import UserError


class ProductConfiguratorWizard(models.TransientModel):
    _name = 'product.configurator.wizard'
    _description = 'Product Configurator'

    product_tmpl_id = fields.Many2one('product.template', string="Product Template", domain=[('variant_type', '=', 'configurable')], required=True)

    attribute_line_ids = fields.One2many('product.configure.attribute.line', 'configure_id', string="Attributes")
    product_configurator = fields.Char(string="Product Configurator")

    @api.multi
    def action_create_variant(self):
        data = json.loads(self.product_configurator)
        value_ids = [r['value'] for r in data['result']]
        variant = self._find_variant_if_exist(value_ids)
        if not variant:
            vals = {
                'product_tmpl_id': self.product_tmpl_id.id,
                'attribute_value_ids': [(4, v_id) for v_id in value_ids],
            }

            variant = self.env['product.product'].create(vals)

        saleOrder = self.env['sale.order'].browse(self.env.context.get('active_id'))
        saleOrder.write({'order_line': [(0, 0, {'product_id': variant.id})]})
        return {'type': 'ir.actions.act_window_close'}

    def _find_variant_if_exist(self, value_ids):
        for variant in self.product_tmpl_id.product_variant_ids:
            if (set(variant.attribute_value_ids.ids) == set(value_ids)):
                return variant
        return False

    @api.onchange('product_tmpl_id')
    def _onchange_product_tmpl_id(self):
        if self.product_tmpl_id:
            data = {'data': [], 'result': []}
            for line in self.product_tmpl_id.attribute_line_ids:
                data['data'].append({
                        'id': line.attribute_id.id,
                        'name': line.attribute_id.name,
                        'type': line.attribute_id.type,
                        'values': [{'id': v.id, 'name': v.name, 'html_color': v.html_color} for v in line.attribute_id.value_ids]
                })

                data['result'].append({
                    'id': line.attribute_id.id,
                    'value': line.attribute_id.value_ids.ids[0]
                })

            data = json.dumps(data)
            self.product_configurator = data


class ProductConfigureAttributeLines(models.TransientModel):
    _name = 'product.configure.attribute.line'

    configure_id = fields.Many2one('product.configurator.wizard', string="Product Configurator")
    product_tmpl_id = fields.Many2one(related="configure_id.product_tmpl_id", relation="product.template")
    attribute_id = fields.Many2one('product.attribute', string="Attributes")
    value_id = fields.Many2one('product.attribute.value', string="Values")
