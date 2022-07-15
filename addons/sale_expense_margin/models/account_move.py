# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class AccountMoveLine(models.Model):
    _inherit = 'account.move.line'

    def _sale_prepare_sale_line_values(self, order, price):
        # When re-invoicing the expense on the SO, set the cost to the total untaxed amount of the expense
        self.ensure_one()
        res = super()._sale_prepare_sale_line_values(order, price)
        if self.expense_id:
            res['purchase_price'] = self.expense_id.untaxed_amount
        return res
