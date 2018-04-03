# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _


class GstItcType(models.Model):
    _name = 'gst.itc.type'
    _description = "Input Tax Credit Type under GST"

    name = fields.Char("Name", required=True)
    product_type = fields.Selection([
        ('consu', 'Consumable'),
        ('service', 'Service'),
        ('product', 'Stockable Product')], string="Product type", required=True)

    _sql_constraints = [
        ('product_type_and_name', 'unique (name ,product_type)', 'This ITC Type is already created!')
    ]
