# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class SaleOrderLine(models.Model):
    _inherit = "sale.order.line"

    generated_gift_card_ids = fields.One2many('gift.card', "buy_line_id", string="Bought Gift Card")
    gift_card_id = fields.Many2one('gift.card', help="Deducted from this Gift Card", copy=False)

    def _is_not_sellable_line(self):
        return self.gift_card_id or super()._is_not_sellable_line()

    def _create_gift_cards(self):
        return self.env['gift.card'].create(
            [self._build_gift_card() for _i in range(int(self.product_uom_qty))]
        )

    def _build_gift_card(self):
        return {
            'initial_amount': self.order_id.currency_id._convert(
                self.price_unit,
                self.order_id.env.company.currency_id,
                self.order_id.env.company,
                fields.Date.today()
            ),
            'buy_line_id': self.id,
        }
