# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class SaleOrderLine(models.Model):
    _inherit = "sale.order.line"

    def unlink(self):
        # Due to delivery_set and delivery_unset methods that are called everywhere, don't unlink
        # reward lines if it's a free shipping
        self = self.exists()
        orders = self.mapped('order_id')
        applied_programs = orders.mapped('no_code_promo_program_ids') + \
                           orders.mapped('code_promo_program_id') + \
                           orders.mapped('applied_coupon_ids').mapped('program_id')
        free_shipping_products = applied_programs.filtered(
            lambda program: program.reward_type == 'free_shipping'
        ).mapped('discount_line_product_id')
        lines_to_unlink = self.filtered(lambda line: line.product_id not in free_shipping_products)
        # Unless these lines are the last ones
        res = super(SaleOrderLine, lines_to_unlink).unlink()
        only_free_shipping_line_orders = orders.filtered(lambda order: len(order.order_line.ids) == 1 and order.order_line.is_reward_line)
        super(SaleOrderLine, only_free_shipping_line_orders.mapped('order_line')).unlink()
        return res
