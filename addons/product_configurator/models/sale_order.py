# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api

class SaleOrderLine(models.Model):

    _inherit = "sale.order.line"

    is_configurable = fields.Boolean()
    custom_value_ids = fields.One2many(related='product_id.custom_value_ids', relation='product.attribute.value.custom', string="Custom Values")
