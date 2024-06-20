# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from collections import defaultdict

from odoo import models, fields, api
from odoo.tools import float_round


class StockMove(models.Model):
    _inherit = "stock.move"

    wip_production_id = fields.Many2one('mrp.production', 'Production Order for components (WIP posted)', check_company=True, index='btree_not_null')

    def _filter_anglo_saxon_moves(self, product):
        res = super(StockMove, self)._filter_anglo_saxon_moves(product)
        res += self.filtered(lambda m: m.bom_line_id.bom_id.product_tmpl_id.id == product.product_tmpl_id.id)
        return res

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

    def _get_src_account(self, accounts_data):
        if self._is_production():
            return self.location_id.valuation_out_account_id.id or accounts_data['production'].id or accounts_data['stock_input'].id
        return super()._get_src_account(accounts_data)

    def _get_dest_account(self, accounts_data):
        if self._is_production_consumed() or self._is_wip():
            return self.location_dest_id.valuation_in_account_id.id or accounts_data['production'].id or accounts_data['stock_output'].id
        return super()._get_dest_account(accounts_data)

    def _is_production(self):
        self.ensure_one()
        return self.location_id.usage == 'production' and self.location_dest_id._should_be_valued()

    def _is_production_consumed(self):
        self.ensure_one()
        return self.location_dest_id.usage == 'production' and self.location_id._should_be_valued()

    @api.depends('wip_production_id')
    def _compute_location_dest_id(self):
        ids_to_super = set()
        for move in self:
            if move.wip_production_id:
                move.location_dest_id = move.wip_production_id.picking_type_id.production_wip_location
            else:
                ids_to_super.add(move.id)
        return super(StockMove, self.browse(ids_to_super))._compute_location_dest_id()

    def _generate_valuation_lines_data(self, partner_id, qty, debit_value, credit_value, debit_account_id, credit_account_id, svl_id, description):
        rslt = super()._generate_valuation_lines_data(partner_id, qty, debit_value, credit_value, debit_account_id, credit_account_id, svl_id, description)

        labour_amounts = defaultdict(float)

        for acc, aml_ids in self.production_id.workorder_ids.time_ids.account_move_line_id.grouped('account_id').items():
            labour_amounts[acc] += sum(aml_ids.mapped('balance'))
        workcenter_cost = sum(labour_amounts.values())

        if self.company_id.currency_id.is_zero(workcenter_cost):
            return rslt

        cost_share = 1
        if self.production_id.move_byproduct_ids:
            if self.cost_share:
                cost_share = self.cost_share / 100
            else:
                cost_share = float_round(1 - sum(self.production_id.move_byproduct_ids.mapped('cost_share')) / 100, precision_rounding=0.0001)
        rslt['credit_line_vals']['balance'] += workcenter_cost * cost_share
        for acc, amt in labour_amounts.items():
            rslt['labour_credit_line_vals_' + acc.code] = {
                'name': description,
                'product_id': self.product_id.id,
                'quantity': qty,
                'product_uom_id': self.product_id.uom_id.id,
                'ref': description,
                'partner_id': partner_id,
                'balance': -amt * cost_share,
                'account_id': acc.id,
            }
        return rslt

    def _is_wip(self):
        self.ensure_one()
        return (self.raw_material_production_id
                and self.location_id.usage == 'production' and self.location_dest_id.usage == 'production'
                and self.raw_material_production_id.picking_type_id.production_wip_location == self.location_id)

    def _create_wip_svl(self):
        new_svls = self.env['stock.valuation.layer']
        for move in self:
            new_svls |= move.move_orig_ids.stock_valuation_layer_ids[0].copy({
                'stock_move_id': move.id,
                'account_move_id': False,
                'account_move_line_id': False,
            })
        return new_svls

    def _get_valued_types(self):
        return super()._get_valued_types() + ['wip']

    def _account_entry_move(self, qty, description, svl_id, cost):
        am_vals_list = super()._account_entry_move(qty, description, svl_id, cost)
        if self.product_id.is_storable and not self._should_exclude_for_valuation() and self._is_wip():
            journal_id, acc_src, acc_dest, _acc_val = self._get_accounting_data_for_valuation()
            am_vals_list.append(self._prepare_account_move_vals(
                acc_src, acc_dest, journal_id, qty, description, svl_id, -cost
            ))
        return am_vals_list
