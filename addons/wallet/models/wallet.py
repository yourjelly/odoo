# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from functools import reduce

from odoo import api, fields, models
from odoo.exceptions import ValidationError


class Wallet(models.Model):
    _name = "wallet"
    _description = "Partner Wallet"

    currency_id = fields.Many2one('res.currency',
                                  string='Currency',
                                  readonly=True,
                                  default=lambda self: self.env.company.currency_id.id,
                                  required=True)

    partner_id = fields.Many2one("res.partner", required=True)

    wallet_transaction_ids = fields.One2many("wallet.transaction", "wallet_id")
    wallet_transactions_count = fields.Integer(compute="_compute_wallet_vars")
    balance = fields.Monetary(currency_field='currency_id', compute="_compute_wallet_vars")
    actual_balance = fields.Monetary(currency_field='currency_id', compute="_compute_wallet_vars")

    @api.depends("wallet_transaction_ids")
    def _compute_wallet_vars(self):
        for record in self:
            record.wallet_transactions_count = len(record.wallet_transaction_ids)
            record.balance = reduce(
                lambda o1, o2: (o1 + o2.get(currency_id=record.currency_id)),
                record.wallet_transaction_ids.filtered(lambda w_t: not w_t.is_debit or w_t.is_confirmed), 0
            )
            record.actual_balance = reduce(
                lambda o1, o2: (o1 + o2.get(currency_id=record.currency_id)),
                record.wallet_transaction_ids, 0
            )

    def add_debit(self, order_id):
        if order_id.add_update_wallet_transaction(force_create=True):
            self.release_no_confirmed_order()
            self.env["wallet.transaction"].create({
                'wallet_id': self.id,
                'sale_order_line_id': order_id.order_line_wallet_id.id
            })

    def add_credit(self, gift_card_id):
        self.env["wallet.transaction"].create({
            'wallet_id': self.id,
            'gift_card_id': gift_card_id.id
        })

    def how_much_can_be_retained(self, amount, currency_id):
        return min(amount, self.currency_id._convert(self.balance, currency_id, self.env.company, fields.Date.today()))

    def release_no_confirmed_order(self):
        self.wallet_transaction_ids.filtered(lambda w_t: w_t.is_debit and not w_t.is_confirmed).unlink()


class WalletTransaction(models.Model):
    _name = "wallet.transaction"
    _description = "Partner Wallet Transaction"
    _order = "create_date desc"

    is_debit = fields.Boolean(help="Is a debit transaction?", compute="_compute_is_debit")
    is_confirmed = fields.Boolean(compute='_compute_is_confirmed', help="Is a sale order confirmed?.")
    wallet_id = fields.Many2one("wallet")
    sale_order_line_id = fields.Many2one("sale.order.line", ondelete="cascade")
    gift_card_id = fields.Many2one('gift.card', ondelete="cascade")

    @api.depends("sale_order_line_id.state")
    def _compute_is_confirmed(self):
        for record in self:
            record.is_confirmed = record.is_debit and record.sale_order_line_id.state == 'sale'

    @api.constrains("gift_card_id")
    def _link_gift_card(self):
        for record in self:
            record.gift_card_id.wallet_transaction_id = record

    @api.depends("gift_card_id")
    def _compute_is_debit(self):
        for record in self:
            record.is_debit = not record.gift_card_id.id

    @api.constrains("gift_card_id", "sale_order_line_id")
    def _constraint_methods(self):
        for _ in self.filtered(lambda wt: not wt.gift_card_id and not wt.sale_order_line_id):
            raise ValidationError(_("The wallet transaction must contain a gift card or an order line."))

    def get(self, currency_id):
        if self.is_debit:
            return self.sale_order_line_id.currency_id._convert(self.sale_order_line_id.price_unit,
                                                                currency_id, self.env.company,
                                                                self.create_date)
        else:
            return self.gift_card_id.currency_id._convert(self.gift_card_id.amount,
                                                          currency_id, self.env.company,
                                                          self.create_date)
