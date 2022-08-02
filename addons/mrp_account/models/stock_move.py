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


class StockMoveLine(models.Model):
    _inherit = "stock.move.line"

    @api.model_create_multi
    def create(self, vals_list):
        self_context = self.with_context({'set_zero_qty': True})
        move_lines = super(StockMoveLine, self).create(vals_list)
        for move_line in move_lines:
            move = move_line.move_id
            production_id = self.env['mrp.production'].search([('name', '=', move_line.origin)], limit=1)
            if production_id and move_line.qty_done and production_id.product_id.cost_method in (
                            'average', 'fifo') and production_id.state in ['done', 'to_close']:
                bom_qty = sum([bom_line.product_qty for bom_line in production_id.bom_id.bom_line_ids if
                               production_id.bom_id and production_id.bom_id.bom_line_ids and bom_line.product_id == move_line.product_id])
                byproduct_qty = sum([bom_line.product_qty for bom_line in production_id.bom_id.byproduct_ids if
                                     production_id.bom_id and production_id.bom_id.byproduct_ids and bom_line.product_id == move_line.product_id])
                if move_line.product_id.id not in production_id.move_byproduct_ids.mapped(
                        'product_id').ids and not bom_qty and move_line.product_id != production_id.product_id or bom_qty:
                    self_context._create_correction_svl(move, -abs(move_line.qty_done))
                elif move_line.product_id.id in production_id.move_byproduct_ids.mapped(
                        'product_id').ids and not byproduct_qty or byproduct_qty and not move.cost_share and not bom_qty \
                        and move_line.product_id != production_id.product_id or bom_qty:
                    self_context._create_correction_svl(move, move_line.qty_done)
        return move_lines

    def write(self, vals):
        if 'qty_done' in vals:
            self_context = self.with_context({'set_zero_qty': True})
            for move_line in self:
                move = move_line.move_id
                production_id = self.env['mrp.production'].search([('name', '=', move_line.origin)], limit=1)
                if production_id and production_id.product_id.cost_method in ('average', 'fifo') and production_id.state == 'done':
                    production_id.product_id.button_bom_cost()
                    if move_line.product_id.id in production_id.move_finished_ids.mapped('product_id').ids:
                        bom_qty = vals['qty_done'] - move_line.qty_done
                        self_context._create_correction_svl(move, bom_qty)
                    elif move.product_uom_qty != vals['qty_done']:
                        bom_qty = sum([bom_line.product_qty for bom_line in production_id.bom_id.bom_line_ids if
                                       production_id.bom_id and production_id.bom_id.bom_line_ids and bom_line.product_id == move_line.product_id])
                        if not bom_qty or bom_qty and bom_qty != vals['qty_done']:
                            bom_qty = move_line.qty_done - vals['qty_done']
                            self_context._create_correction_svl(move, bom_qty)
        return super(StockMoveLine, self).write(vals)

    @api.model
    def _create_correction_svl(self, move, diff):
        res = super(StockMoveLine, self)._create_correction_svl(move, diff)
        context_zeros = self.env.context.get('set_zero_qty')
        if diff and context_zeros:
            res.write({'quantity': 0.00})
            production_id = self.env['mrp.production'].search([('name', '=', move.origin)], limit=1)
            if move.product_id.id in production_id.move_finished_ids.mapped('product_id').ids:
                res.write({'value': -abs(res.value) if res.value > 0 else abs(res.value)})
        return res
