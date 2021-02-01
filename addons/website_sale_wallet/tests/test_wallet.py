# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields
from odoo.addons.website_sale_wallet.tests.common import TestGiftCardCommon


class TestWallet(TestGiftCardCommon):

    @classmethod
    def setUpClass(cls):
        super(TestWallet, cls).setUpClass()
        cls.gift_card = cls.env['gift.card'].create({
            'amount': 100,
        })
        cls.tax_10pc_incl = cls.env['account.tax'].create({
            'name': "10% Tax incl",
            'amount_type': 'percent',
            'amount': 10,
            'price_include': True,
        })

        # products
        cls.product_A = cls.env['product.product'].create({
            'name': 'Product A',
            'list_price': 100,
            'sale_ok': True,
            'taxes_id': [(6, 0, [cls.tax_10pc_incl.id])],
        })
        cls.website1 = cls.env.ref('website.default_website')

    def test_01_add_a_single_gift_card_to_wallet(self):
        initial_amount = 100
        gift_card = self.env['gift.card'].create({
            'amount': initial_amount,
        })
        self.partner.with_context(website_id=self.website1.id).add_gift_card(gift_card)
        self.assertEqual(gift_card.partner_id, self.partner)
        wallet = self.partner.get_wallet()
        self.assertEqual(wallet.balance, initial_amount)
        self.assertEqual(wallet.actual_balance, initial_amount)
        self.assertEqual(wallet.wallet_transactions_count, 1)

    def test_02_add_a_multiple_gift_card_to_wallet(self):
        initial_amount_1 = 100
        initial_amount_2 = 50
        gift_card_1 = self.env['gift.card'].create({
            'amount': initial_amount_1,
        })
        gift_card_2 = self.env['gift.card'].create({
            'amount': initial_amount_2,
        })
        self.partner.with_context(website_id=self.website1.id).add_gift_card(gift_card_1)
        self.partner.add_gift_card(gift_card_2)
        self.assertEqual(gift_card_1.partner_id, self.partner)
        self.assertEqual(gift_card_2.partner_id, self.partner)
        wallet = self.partner.get_wallet()
        self.assertEqual(wallet.balance, initial_amount_1 + initial_amount_2)
        self.assertEqual(wallet.actual_balance, initial_amount_1 + initial_amount_2)
        self.assertEqual(wallet.wallet_transactions_count, 2)

    def test_03_pay_with_wallet(self):
        initial_amount = 100
        gift_card = self.env['gift.card'].create({
            'amount': initial_amount,
        })
        self.partner.with_context(website_id=self.website1.id).add_gift_card(gift_card)
        order = self.empty_order
        order.write({'order_line': [
            (0, False, {
                'product_id': self.product_A.id,
                'name': 'Product A',
                'product_uom': self.uom_unit.id,
                'product_uom_qty': 1.0,
            })]
        })
        # before
        total_amount_before = order.amount_total
        wallet_id = self.partner.with_context(website_id=self.website1.id).get_wallet()
        actual_balance_before = wallet_id.actual_balance
        balance_before = wallet_id.balance
        # pay with wallet
        self.partner.with_context(website_id=self.website1.id).pay_with_wallet(order)
        # after
        total_amount_after = order.amount_total
        actual_balance_after = wallet_id.actual_balance
        balance_after = wallet_id.balance
        # test after
        self.assertEqual(balance_after, balance_before)
        diff_total_amount = total_amount_before - total_amount_after
        self.assertEqual(actual_balance_before - actual_balance_after,
                         order.currency_id._convert(diff_total_amount, self.env.company.currency_id,
                                                    self.env.company, fields.Date.today()))
        self.assertEqual(len(wallet_id.wallet_transaction_ids.filtered(
            lambda w_t: w_t.is_debit and not w_t.is_confirmed)
        ), 1)
        # confirm order
        order.action_confirm()
        wallet_transactions_ids_after_confirm = wallet_id.wallet_transaction_ids
        self.assertEqual(len(wallet_transactions_ids_after_confirm), 2)
        self.assertEqual(len(wallet_transactions_ids_after_confirm.filtered(
            lambda w_t: w_t.is_debit and not w_t.is_confirmed)
        ), 0)
