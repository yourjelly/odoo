# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests.common import TransactionCase
from odoo.exceptions import UserError


class TestDeleteOrder(TransactionCase):
    def setUp(self):
        super(TestDeleteOrder, self).setUp()
        self.User = self.env['res.users']
        self.res_users_purchase_user = self.User.create({
            'company_id': self.ref('base.main_company'),
            'name': "Purchase User",
            'login': "pu",
            'email': "purchaseuser@yourcompany.com",
            'groups_id': [(6, 0, [self.ref('purchase.group_purchase_user')])],
            })
        self.purchase_order_1 = self.env.ref('purchase.purchase_order_1').sudo(self.res_users_purchase_user.id)
        self.purchase_order_7 = self.env.ref('purchase.purchase_order_7').sudo(self.res_users_purchase_user.id)
        self.purchase_order_5 = self.env.ref('purchase.purchase_order_5').sudo(self.res_users_purchase_user.id)

    def test_00_delete_order(self):
        ''' Testcase for deleting purchase order'''
        # In order to test delete process on purchase order, I tried to delete a confirmed order and check Error Message.
        with self.assertRaises(UserError):
            self.purchase_order_1.unlink()
        # I tried to delete a cancelled order.
        self.purchase_order_7.button_cancel()
        self.assertEqual(self.purchase_order_7.state, 'cancel', 'PO is cancelled!')
        self.purchase_order_7.unlink()

        # I deleted a draft order after cancelling it.
        self.assertEqual(self.purchase_order_5.state, 'draft', 'PO in draft state!')
        self.purchase_order_5.button_cancel()
        self.assertEqual(self.purchase_order_5.state, 'cancel', 'PO is cancelled!')
        self.purchase_order_5.unlink()
