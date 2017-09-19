# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import json

from odoo import api, fields, models, _
from odoo.exceptions import UserError


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
        data = json.loads(self.product_configurator)
        value_ids = [r['value'] for r in data['result'] if r['type'] != 'custom']
        custom_values = [{
            'id': r['id'],
            'value': r['value'],
            'value_type': r['value_type'],
            'name': r.get('name', False)
        } for r in data['result'] if r['type'] == 'custom' and r['value']]

        variant = self._find_variant_if_exist(value_ids)
        #create a new variant if variant not found
        if not variant:
            vals = self._prepare_variant_vals(value_ids, custom_values)
            variant = self.env['product.product'].create(vals)

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

    def _find_variant_if_exist(self, value_ids):
        for variant in self.product_tmpl_id.product_variant_ids:
            if (set(variant.attribute_value_ids.ids) == set(value_ids)):
                return variant
        return False

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
        return {
            'id': attribute_line.attribute_id.id,
            'name': attribute_line.attribute_id.name,
            'type': attribute_line.attribute_id.type,
            'value_type': attribute_line.attribute_id.value_type,
            'values': [{'id': v.id, 'name': v.name, 'html_color': v.html_color} for v in attribute_line.value_ids]
        }

    def _prepare_variant_vals(self, value_ids, custom_values=None):
        vals = {
                'product_tmpl_id': self.product_tmpl_id.id,
                'attribute_value_ids': [(4, v_id) for v_id in value_ids],
            }

        if len(custom_values):
            data = []
            for custom_v in custom_values:
                if custom_v['value_type'] != 'binary':
                    data.append((0, 0, {
                        'attribute_id': custom_v['id'],
                        'value': custom_v['value']}))
                else:
                    data.append((0, 0, {
                        'attribute_id': custom_v['id'],
                        'attachment_ids': [(0, 0, self._get_attachment_value(custom_v['value'], custom_v['name']))]}))
            vals.update(custom_value_ids=data)

        return vals

    def _extra_line_values(self, product):
        return {
            'name': product.display_name,
        }

    def _get_attachment_value(self, file, file_name):
        return {
            'name': file_name,
            'datas': file,
            'datas_fname': file_name,
        }
