# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models


class SaleOrderLine(models.Model):
    _inherit = "sale.order.line"

    @api.depends('is_expense')
    def _compute_purchase_price(self):
        not_expense_lines = self.filtered(lambda sol: not sol.is_expense)
        return super(SaleOrderLine, not_expense_lines)._compute_purchase_price()
