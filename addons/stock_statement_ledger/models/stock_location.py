# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _, api, fields, models


class StockLocation(models.Model):
    _inherit = "stock.location"

    is_preproduction_location = fields.Boolean(string="Pre-production Location", default=False)
