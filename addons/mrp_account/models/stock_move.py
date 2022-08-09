# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _, api, models

class StockMove(models.Model):
    _inherit = "stock.move"

    def _filter_anglo_saxon_moves(self, product):
        res = super(StockMove, self)._filter_anglo_saxon_moves(product)
        res += self.filtered(lambda m: m.bom_line_id.bom_id.product_tmpl_id.id == product.product_tmpl_id.id)
        return res

    def _generate_analytic_lines_data(self, unit_amount, amount):
        vals = super()._generate_analytic_lines_data(unit_amount, amount)
        if self.raw_material_production_id.analytic_account_id:
            vals['name'] = _('[Raw] %s', self.product_id.display_name)
            vals['ref'] = self.raw_material_production_id.display_name
            vals['category'] = 'manufacturing_order'
        return vals

    def _get_analytic_account(self):
        account = self.raw_material_production_id.analytic_account_id
        if account:
            return account
        return super()._get_analytic_account()

    def _get_src_account(self, accounts_data):
        if not self.unbuild_id:
            return super()._get_src_account(accounts_data)
        else:
            return self.location_dest_id.valuation_out_account_id.id or accounts_data['stock_input'].id

    def _get_dest_account(self, accounts_data):
        if not self.unbuild_id:
            return super()._get_dest_account(accounts_data)
        else:
            return self.location_id.valuation_in_account_id.id or accounts_data['stock_output'].id

    def _is_returned(self, valued_type):
        if self.unbuild_id:
            return True
        return super()._is_returned(valued_type)

    def write(self, vals):
        moves = super(StockMove, self).write(vals)
        if 'cost_share' in vals:
            for move in self:
                production_id = move.production_id or move.raw_material_production_id
                if production_id and production_id.state == 'done' and production_id.product_id.cost_method in (
                        'average', 'fifo') and move.product_id != production_id.product_id:
                    stock_val_layers = self.env['stock.valuation.layer'].search([('id', 'in', (
                            production_id.move_raw_ids + production_id.move_finished_ids + production_id.scrap_ids.move_id).stock_valuation_layer_ids.ids)])
                    byproduct_valuation = sum(stock_val_layers.filtered(lambda p: p.product_id == move.product_id).mapped('value'))
                    production_valuation = sum(stock_val_layers.filtered(lambda p: p.product_id == production_id.product_id).mapped('value'))
                    production_move = production_id.move_finished_ids.filtered(lambda l: l.product_id == production_id.product_id)
                    total_cost = byproduct_valuation + production_valuation
                    byprod_cost = (total_cost * move.cost_share) / 100
                    production_cost = total_cost - byprod_cost
                    updated_production_cost = production_cost - production_valuation
                    production_qty = updated_production_cost / production_id.product_id.standard_price if production_id.product_id.standard_price else 1
                    updated_byproduct_cost = byprod_cost - byproduct_valuation
                    byproduct_qty = updated_byproduct_cost / move.product_id.standard_price if move.product_id.standard_price else 1
                    for move_line in production_move.move_line_ids:
                        move_line.with_context({'set_zero_qty': True})._create_correction_svl(production_move, production_qty)
                    for byproduct_move in production_id.move_byproduct_ids:
                        if byproduct_move.id == move._origin.id:
                            for move_line in move.move_line_ids:
                                move_line.with_context({'set_zero_qty': True})._create_correction_svl(byproduct_move, byproduct_qty)
        return moves

class StockMoveLine(models.Model):
    _inherit = "stock.move.line"

    @api.model_create_multi
    def create(self, vals_list):
        def create_valuation_layer(production, move):
            if production and move_line.qty_done and production.product_id.cost_method in ('average', 'fifo') and \
                    production.state == 'done' and move_line.product_id != production.product_id:
                if move_line.product_id.id not in production.move_byproduct_ids.mapped('product_id').ids:
                    production_cost = move_line.qty_done * move_line.product_id.standard_price
                    production_qty = self.generate_production_quantity(production.move_byproduct_ids, move_line.qty_done, production_cost, production, is_qty_positive=True)
                    production_move = production.move_finished_ids.filtered(lambda l: l.product_id == production.product_id)
                    self_context._create_correction_svl(production_move, abs(production_qty) if move_line.qty_done > 0 else -abs(production_qty))
                elif move_line.product_id.id in production.move_byproduct_ids.mapped('product_id').ids:
                    self_context._create_correction_svl(move, abs(move_line.qty_done) if move_line.qty_done < 0 else -abs(move_line.qty_done))
        self_context = self.with_context({'set_zero_qty': True})
        move_lines = super(StockMoveLine, self).create(vals_list)
        for move_line in move_lines:
            move = move_line.move_id
            production = move.production_id or move.raw_material_production_id
            create_valuation_layer(production, move)
        return move_lines

    def write(self, vals):
        def create_valuation_layer(production, move):
            if production.product_id.cost_method in ('average', 'fifo') and production.state == 'done':
                if move_line.product_id.id in production.move_finished_ids.mapped('product_id').ids:
                    qty = vals['qty_done'] - move_line.qty_done
                    self_context._create_correction_svl(move, abs(qty) if qty < 0 else -abs(qty))
                elif move.product_uom_qty != vals['qty_done']:
                    qty = move_line.qty_done - vals['qty_done']
                    production_move = production.move_finished_ids.filtered(lambda l: l.product_id == production.product_id)
                    production_cost = qty * move_line.product_id.standard_price
                    production_qty = self.generate_production_quantity(production.move_byproduct_ids, qty,
                                                                       production_cost, production, is_qty_positive=False)
                    self_context._create_correction_svl(production_move, abs(production_qty) if qty < 0 else -abs(production_qty))
        if 'qty_done' in vals:
            self_context = self.with_context({'set_zero_qty': True})
            for move_line in self:
                move = move_line.move_id
                production = move.production_id or move_line.production_id or move.raw_material_production_id
                create_valuation_layer(production, move)
        return super(StockMoveLine, self).write(vals)

    def generate_production_quantity(self, byproduct_move_ids, qty, production_cost, production, is_qty_positive):
        byproduct_cost_list = []
        self_context = self.with_context({'set_zero_qty': True})
        for byproduct_move in byproduct_move_ids:
            if byproduct_move.cost_share:
                product_cost = byproduct_move.product_id.standard_price
                byproduct_cost = (production_cost * byproduct_move.cost_share) / 100
                byproduct_cost_list.append(byproduct_cost)
                byproduct_qty = byproduct_cost / product_cost if product_cost else 1
                if is_qty_positive:
                    self_context._create_correction_svl(byproduct_move, abs(byproduct_qty) if qty > 0 else -abs(byproduct_qty))
                else:
                    self_context._create_correction_svl(byproduct_move, abs(byproduct_qty) if qty < 0 else -abs(byproduct_qty))
        main_cost = production_cost - sum(byproduct_cost_list) if byproduct_cost_list else production_cost
        product_cost = production.product_id.standard_price
        production_qty = main_cost / product_cost if product_cost else 1
        return production_qty

    @api.model
    def _create_correction_svl(self, move, diff):
        res = super(StockMoveLine, self)._create_correction_svl(move, diff)
        if diff and self.env.context.get('set_zero_qty'):
            res.write({'quantity': 0.00})
        return res
