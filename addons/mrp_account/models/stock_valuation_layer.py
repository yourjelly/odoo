# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import models
from odoo.tools import float_is_zero


class StockValuationLayer(models.Model):
    _inherit = 'stock.valuation.layer'


    def _validate_accounting_entries(self):
        super()._validate_accounting_entries()
        # post final analytic entries for MO
        vals_list = []
        for svl in self:
            move = svl.stock_move_id
            analytic_account = move.raw_material_production_id.analytic_account_id
            if analytic_account:
                precision_rounding = analytic_account.currency_id.rounding
                if not float_is_zero(svl.value, precision_rounding=precision_rounding):
                    vals_list.append(move._prepare_analytic_line(svl.quantity, svl.value))
        self.stock_move_id.analytic_account_line_id.unlink()
        self.env['account.analytic.line'].sudo().create(vals_list)
