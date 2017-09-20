# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import json

from odoo import api, fields, models, _
from odoo.exceptions import UserError, ValidationError


class ProductConfiguratorWizard(models.TransientModel):
    _name = 'product.configurator.wizard'
    _description = 'Product Configurator'

    product_tmpl_id = fields.Many2one('product.template', string="Product Template", domain=[('variant_type', '=', 'configurable')], required=True)
    product_configurator = fields.Char(string="Product Configurator")
    order_line_id = fields.Many2one('sale.order.line', readonly=True)

    @api.model
    def default_get(self, fields):
        res = super(ProductConfiguratorWizard, self).default_get(fields)
        if self.env.context.get('active_model') == 'sale.order.line' and self.env.context.get('active_id'):
            SaleOrderLine = self.env['sale.order.line'].browse(self.env.context['active_id'])
            res.update(
                order_line_id=SaleOrderLine.id,
                product_tmpl_id=SaleOrderLine.product_id.product_tmpl_id.id)
        return res

    @api.multi
    def action_create_variant(self):
        data = self._get_data()
        try:
            variant = self.product_tmpl_id.create_get_variant(data['value_ids'], data['custom_values'])
        except ValidationError:
            raise
        except:
            raise ValidationError(
                _('Invalid configuration! Please check all '
                  'required fields.')
            )

        line_values = {'product_id': variant.id}
        if self.order_line_id:
            line_values.update(self._extra_line_values(variant))
            self.order_line_id.write(line_values)
        else:
            saleOrder = self.env['sale.order'].browse(self.env.context.get('active_id'))
            line_values.update(is_configurable=True)
            saleOrder.write({
                'order_line': [(0, 0, line_values)]})

        return {'type': 'ir.actions.act_window_close'}

    @api.onchange('product_tmpl_id')
    def _onchange_product_tmpl_id(self):
        if self.product_tmpl_id:
            data = {'data': [], 'result': []}
            for line in self.product_tmpl_id.attribute_line_ids.filtered(lambda l: l.value_ids or l.attribute_id.type == 'custom'):
                data['data'].append(self._prepare_attribute_data(line))
                if not self.order_line_id:
                    data['result'].append({
                        'id': line.attribute_id.id,
                        'value': line.value_ids and line.value_ids.ids[0] or '',
                        'type': line.attribute_id.type,
                        'value_type': line.attribute_id.value_type
                    })
            if self.order_line_id:
                data['result'] = self._prepare_default_data()

            data = json.dumps(data)
            self.product_configurator = data

    def _get_data(self):
        data = {'value_ids': [], 'custom_values': {}}
        result_data = json.loads(self.product_configurator)

        for res in result_data['result']:
            if res['type'] != 'custom':
                data['value_ids'].append(res['value'])
            else:
                data['custom_values'][res['id']] = {
                    'id': res['id'],
                    'value': res['value'],
                    'value_type': res['value_type'],
                    'name': res.get('name', False)
                }
        return data

    def _prepare_default_data(self):
        data = []
        value_ids = self.order_line_id.product_id.attribute_value_ids
        if value_ids:
            for value in value_ids:
                data.append({
                    'id': value.attribute_id.id,
                    'value': value.id,
                    'type': value.attribute_id.type,
                    'value_type': value.attribute_id.value_type
                })

            for custom_v in self.order_line_id.product_id.custom_value_ids:
                data.append({
                    'id': custom_v.attribute_id.id,
                    'value': custom_v.value,
                    'type': custom_v.attribute_id.type,
                    'value_type': custom_v.attribute_id.value_type
                })

        return data

    def _prepare_attribute_data(self, attribute_line):
        attribute = attribute_line.attribute_id
        return {
            'id': attribute.id,
            'name': attribute.name,
            'type': attribute.type,
            'require': attribute.is_required,
            'value_type': attribute.value_type,
            'values': [{'id': v.id, 'name': v.name, 'html_color': v.html_color} for v in attribute_line.value_ids]
        }

    def _extra_line_values(self, product):
        return {
            'name': product.display_name,
        }
