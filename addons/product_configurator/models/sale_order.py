# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class SaleOrderLine(models.Model):
    _inherit = "sale.order.line"

    is_configurable = fields.Boolean(compute="_is_configurable")
    custom_value_ids = fields.One2many(related='product_id.custom_value_ids', relation='product.attribute.value.custom', string="Custom Values")

    @api.depends('product_id')
    def _is_configurable(self):
        for line in self:
            line.is_configurable = line.product_id.product_tmpl_id.variant_type == 'configurable'
