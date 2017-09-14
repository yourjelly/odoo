# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import UserError


class ProductConfiguratorWizard(models.TransientModel):
    _name = 'product.configurator.wizard'
    _description = 'Product Configurator'

    product_tmpl_id = fields.Many2one('product.template', string="Product Template", domain=[('variant_type', '=', 'configurable')], required=True)

    attribute_line_ids = fields.One2many('product.configure.attribute.line', 'configure_id', string="Attributes")

    @api.multi
    def action_create_variant(self):
        variant = self._find_variant_if_exist(self.attribute_line_ids.mapped('value_id'))
        if not variant:
            vals = {
                'product_tmpl_id': self.product_tmpl_id.id,
                'attribute_value_ids': [(4, attr.value_id.id) for attr in self.attribute_line_ids],
            }
            variant = self.env['product.product'].create(vals)

        saleOrder = self.env['sale.order'].browse(self.env.context.get('active_id'))
        saleOrder.write({'order_line': [(0, 0, {'product_id': variant.id})]})
        return {'type': 'ir.actions.act_window_close'}

    def _find_variant_if_exist(self, value_ids):
        for variant in self.product_tmpl_id.product_variant_ids:
            if cmp(variant.attribute_value_ids.ids, value_ids.ids) == 0:
                return variant
        return False


class ProductConfigureAttributeLines(models.TransientModel):
    _name = 'product.configure.attribute.line'

    configure_id = fields.Many2one('product.configurator.wizard', string="Product Configurator")
    product_tmpl_id = fields.Many2one(related="configure_id.product_tmpl_id", relation="product.template")
    attribute_id = fields.Many2one('product.attribute', string="Attributes")
    value_id = fields.Many2one('product.attribute.value', string="Values")
