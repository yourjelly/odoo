# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class StockMove(models.Model):
    _inherit = 'stock.move'

    def _prepare_procurement_values(self):
        res = super()._prepare_procurement_values()
        res['analytic_account_id'] = self.sale_line_id.order_id.analytic_account_id
        return res


class StockMoveLine(models.Model):
    _inherit = 'stock.move.line'

    def _compute_sale_price(self):
        kit_lines = self.filtered(lambda move_line: move_line.move_id.bom_line_id.bom_id.type == 'phantom')
        for move_line in kit_lines:
            price_unit = move_line.move_id.sale_line_id.price_unit
            price_subtotal = move_line.move_id.sale_line_id.price_subtotal
            discount = ((move_line.move_id.sale_line_id.discount * move_line.move_id.sale_line_id.price_unit) / 100)
            reward = -(move_line.move_id.sale_line_id.order_id.reward_amount)
            total_untaxed = move_line.move_id.sale_line_id.order_id.amount_untaxed + reward
            kit_price = move_line.move_id.sale_line_id.product_template_id.standard_price
            product_price = move_line.product_id.product_tmpl_id.standard_price
            qty = move_line.product_uom_id._compute_quantity(move_line.qty_done, move_line.product_id.uom_id)
            unit_price = (((price_unit - (discount if discount else 0) - (((price_subtotal / total_untaxed) * reward) if reward else 0)) * ((product_price * qty)/ kit_price)) / qty) / qty
            move_line.sale_price = unit_price * qty
        super(StockMoveLine, self - kit_lines)._compute_sale_price()
