# -*- coding: utf-8 -*-

from odoo import models, fields


class PosConfig(models.Model):
    _inherit = "pos.config"

    module_pos_invoice = fields.Boolean("Pay Invoices")
    pay_invoice_product_id = fields.Many2one("product.product", string="Pay Invoice Product", domain="[('sale_ok', '=', True)]", help="The product used to create order when paying an invoice.")
