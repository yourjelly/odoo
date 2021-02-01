# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models


class SaleOrder(models.Model):
    _inherit = "sale.order"

    def get_wallet(self):
        return self.partner_id.get_wallet()

    # Compute Func
    @api.depends("partner_id", "website_id")
    def _compute_wallet_balances(self):
        super(SaleOrder, self)._compute_wallet_balances()

    def _compute_website_order_line(self):
        super()._compute_website_order_line()
        for order in self:
            order.website_order_line = order.website_order_line.sorted(key=lambda r: r == self.order_line_wallet_id)

    def _build_gift_card(self, gift_card_order_line):
        gift_card = super(SaleOrder, self)._build_gift_card(gift_card_order_line)
        gift_card.update({
            'website_id': self.website_id.id
        })
        return gift_card
