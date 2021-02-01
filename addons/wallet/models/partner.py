# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class Partner(models.Model):
    _inherit = "res.partner"

    wallet_ids = fields.One2many("wallet", "partner_id", string='Wallets')

    def add_gift_card(self, gift_card_id):
        if gift_card_id.is_new(self):
            wallet_id = self.get_wallet(force_create=True)
            wallet_id.add_credit(gift_card_id)
            return True
        else:
            return False

    def pay_with_wallet(self, order):
        wallet_id = self.get_wallet()
        wallet_id.add_debit(order)

    def get_wallet(self, force_create=False):
        wallet_ids = self.wallet_ids
        if not wallet_ids:
            if force_create:
                return self.env["wallet"].create({
                    'partner_id': self.id,
                })
            return wallet_ids
        return wallet_ids[0]
