# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import fields, models, _


class StockMove(models.Model):
    _inherit = "stock.move"

    analytic_account_line_id = fields.Many2one('account.analytic.line')

    def write(self, vals):
        super().write(vals)
        if 'quantity_done' in vals:
            self._create_or_update_analytic_entry()

    def _action_confirm(self, merge=True, merge_into=False):
        res = super()._action_confirm(merge=merge, merge_into=merge_into)
        res._create_or_update_analytic_entry()
        return res

    def _action_cancel(self):
        self.analytic_account_line_id.unlink()
        return super()._action_cancel()

    def _prepare_analytic_line(self, qty, val):
        self.ensure_one()
        return {
            'name': _('[Raw] %(product)s', product=self.product_id.display_name),
            'amount': val,
            'account_id': self.raw_material_production_id.analytic_account_id.id,
            'unit_amount': qty,
            'product_id': self.product_id.id,
            'product_uom_id': self.product_id.uom_id.id,
            'company_id': self.company_id.id,
            'category': 'manufacturing_order',
        }

    def _create_or_update_analytic_entry(self):
        for move in self.filtered(lambda m: m.raw_material_production_id.analytic_account_id):
            unit_amount = -move.product_uom._compute_quantity(move.quantity_done, move.product_id.uom_id)
            if not move.analytic_account_line_id:
                move.analytic_account_line_id = self.env['account.analytic.line'].sudo().create(
                    move._prepare_analytic_line(unit_amount, unit_amount * move.product_id.standard_price)
                )
            else:
                move.analytic_account_line_id.write({
                    'unit_amount': unit_amount,
                    'amount': unit_amount * move.product_id.standard_price,
                })

    def _is_returned(self, valued_type):
        if self.unbuild_id and self.unbuild_id.mo_id:   # unbuilding a MO
            return True
        return super()._is_returned(valued_type)
