# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.website_sale_wallet.tests.common import TestGiftCardCommon


class TestBuyGiftCardCommon(TestGiftCardCommon):

    @classmethod
    def setUpClass(cls):
        super(TestBuyGiftCardCommon, cls).setUpClass()

        cls.uom_unit = cls.env.ref('uom.product_uom_unit')

        cls.product_gift_card = cls.env['product.product'].create({
            'name': 'Product Gift Card',
            'list_price': 100,
            'sale_ok': True,
            'is_gift_card': True,
            'taxes_id': False,
        })

    def test_01_buying_a_single_gift_card(self):
        order = self.empty_order
        order.write({'order_line': [
            (0, False, {
                'product_id': self.product_gift_card.id,
                'name': 'Gift Card',
                'product_uom': self.uom_unit.id,
                'product_uom_qty': 1.0,
            })]
        })
        order.action_confirm()
        self.assertEqual(order.generated_gift_card_count, 1)
        self.assertEqual(order.generated_gift_card_ids[0].amount, self.product_gift_card.list_price)

    def test_02_buying_multiple_gift_card(self):
        order = self.empty_order
        product_uom_qty = 3
        order.write({'order_line': [
            (0, False, {
                'product_id': self.product_gift_card.id,
                'name': '1 Product A',
                'product_uom': self.uom_unit.id,
                'product_uom_qty': product_uom_qty,
            })]
        })
        self.assertEqual(len(order.generated_gift_card_ids), 0)
        order.action_confirm()
        self.assertEqual(order.generated_gift_card_count, product_uom_qty)
        self.assertEqual(order.currency_id._convert(order.amount_total, self.env.company.currency_id, self.env.company,
                                                    order.date_order),
                         product_uom_qty * self.product_gift_card.list_price)
        self.assertTrue(all([gift_card.amount == self.product_gift_card.list_price
                             and gift_card.sale_order_id == order
                             for gift_card in order.generated_gift_card_ids]))
