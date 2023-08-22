# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _, models


class StockMove(models.Model):
    _inherit = "stock.move"

    def _filter_anglo_saxon_moves(self, product):
        res = super(StockMove, self)._filter_anglo_saxon_moves(product)
        res += self.filtered(lambda m: m.bom_line_id.bom_id.product_tmpl_id.id == product.product_tmpl_id.id)
        return res

    def _generate_analytic_lines_data(self, unit_amount, amount, distribution, account, distribution_on_each_plan):
        vals = super()._generate_analytic_lines_data(unit_amount, amount, distribution, account, distribution_on_each_plan)
        if self._get_analytic_distribution():
            vals['name'] = _('[Raw] %s', self.product_id.display_name)
            vals['ref'] = self.raw_material_production_id.display_name
            vals['category'] = 'manufacturing_order'
        return vals

    def _get_analytic_distribution(self):
        distribution = self.raw_material_production_id.analytic_distribution
        if distribution:
            return distribution
        return super()._get_analytic_distribution()

    def _should_force_price_unit(self):
        self.ensure_one()
        return self.picking_type_id.code == 'mrp_operation' or super()._should_force_price_unit()

    def _ignore_automatic_valuation(self):
        return bool(self.raw_material_production_id)
