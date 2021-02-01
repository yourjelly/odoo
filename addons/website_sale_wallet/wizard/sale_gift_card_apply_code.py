# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _, models


class SaleGiftCardApplyCode(models.TransientModel):
    _name = "gift.card.apply.code"
    _description = "Applying the gift card code to a purchase."

    def add_gift_card(self, gift_card, partner_id):
        error_status = {}
        if not gift_card or not partner_id.add_gift_card(gift_card):
            error_status = {
                'not_found': _('Gift Card is invalid')
            }

        return error_status

    def pay_with_wallet(self, partner, order):
        return partner.pay_with_wallet(order)
