# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import time

from odoo import api, fields, models, _
from odoo.exceptions import UserError


class SaleOrederLineSection(models.Model):
    _name = "sale.order.line.section"
    _description = "Sales Advance Payment Invoice"

    section = fields.Char(string="Section Name")
    sub_total = fields.Boolean(string="Add a subtotal")
    page_break = fields.Boolean(string="Add a page-break")

    @api.multi
    def add_section_line(self):
        return self.section
