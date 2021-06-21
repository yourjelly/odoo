# -*- coding: utf-8 -*-

from odoo import models, fields


class PosConfig(models.Model):
    _inherit = "pos.config"

    module_pos_invoice = fields.Boolean("Pay Invoices")
