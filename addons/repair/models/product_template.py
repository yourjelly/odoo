# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class ProductTemplate(models.Model):
    _inherit = "product.template"

    create_repair_order = fields.Boolean(
        "Create a Repair Order",
        help="If it is check, when you confirm a Sale Order, it will automatically create a linked repair order"
    )
