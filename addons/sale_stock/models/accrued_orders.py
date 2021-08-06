# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class AccruedExpenseRevenue(models.TransientModel):
    _inherit = 'account.accrued.orders.wizard'

    def _get_sale_order_line_amount_to_invoice(self, sale_order_line):
        if sale_order_line.qty_delivered_method == 'stock_move':
            return sale_order_line._get_untaxed_amount_to_invoice(self.date)
        else:
            return super(AccruedExpenseRevenue, self)._get_sale_order_line_amount_to_invoice(sale_order_line)
