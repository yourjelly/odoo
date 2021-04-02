# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import models
from odoo.tools import float_is_zero


class StockValuationLayer(models.Model):
    _inherit = 'stock.valuation.layer'


    def _validate_accounting_entries(self):
        super()._validate_accounting_entries()
        # post analytic entries for MO
        vals_list = []
        for svl in self:
            move = svl.stock_move_id
            analytic_account = (move.production_id or move.raw_material_production_id).analytic_account_id
            if analytic_account:
                vals = move._prepare_move_analytic_line(svl.quantity, svl.value)
                precision_rounding = analytic_account.currency_id.rounding
                if not float_is_zero(vals.get('amount', 0.0), precision_rounding=precision_rounding):
                    vals_list.append(vals)
        self.env['account.analytic.line'].sudo().create(vals_list)
