# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import api, fields, models, _


class StockMove(models.Model):
    _inherit = "stock.move"

    def _is_returned(self, valued_type):
        if self.unbuild_id and self.unbuild_id.mo_id:   # unbuilding a MO
            return True
        return super()._is_returned(valued_type)

    def _prepare_move_analytic_line(self, qty, val):
        self.ensure_one()
        if self.production_id:
            name = _('[Finished] %(product)s', product=self.product_id.display_name)
            account = self.production_id.analytic_account_id.id
        else:
            name = _('[Raw] %(product)s', product=self.product_id.display_name)
            account = self.raw_material_production_id.analytic_account_id.id
        return {
            'name': name,
            'amount': val,
            'account_id': account,
            'unit_amount': qty,
            'product_id': self.product_id.id,
            'product_uom_id': self.product_id.uom_id.id,
            'company_id': self.company_id.id,
        }
