# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.website_sale_wallet.tests.test_wallet import TestWallet


class TestWalletMultiWebsite(TestWallet):

    @classmethod
    def setUpClass(cls):
        super(TestWalletMultiWebsite, cls).setUpClass()
        cls.website2 = cls.env['website'].create({
            'name': 'My Website 2',
            'domain': '',
            'country_group_ids': False,
        })

    def test_01_add_a_different_gift_card_to_different_wallet(self):
        initial_amount = 100
        gift_card_1 = self.env['gift.card'].create({
            'amount': initial_amount,
        })
        gift_card_2 = self.env['gift.card'].create({
            'amount': initial_amount * 2,
        })

        self.partner.with_context(website_id=self.website1.id).add_gift_card(gift_card_1)
        wallet_id = self.partner.with_context(website_id=self.website1.id).get_wallet()
        self.assertEqual(wallet_id.balance, initial_amount)
        self.assertEqual(wallet_id.actual_balance, initial_amount)
        self.assertEqual(wallet_id.wallet_transactions_count, 1)

        self.partner.with_context(website_id=self.website2.id).add_gift_card(gift_card_2)
        wallet_id = self.partner.with_context(website_id=self.website2.id).get_wallet()

        self.assertEqual(wallet_id.balance, initial_amount * 2)
        self.assertEqual(wallet_id.actual_balance, initial_amount * 2)
        self.assertEqual(wallet_id.wallet_transactions_count, 1)
