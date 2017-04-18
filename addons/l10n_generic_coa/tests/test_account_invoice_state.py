# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo.tests.common import TransactionCase


class TestAccountInvoiceState(TransactionCase):
    def setUp(self):
        super(TestAccountInvoiceState, self).setUp()
        invoice_account = self.env['account.account'].search([('user_type_id', '=', self.env.ref('account.data_account_type_receivable').id)], limit=1).id
        self.account_invoice_state = self.env['account.invoice'].create({
            'account_id': invoice_account,
            'partner_id': self.ref('base.res_partner_2'),
            'company_id': self.ref('base.main_company'),
            'currency_id': self.ref('base.EUR'),
            'invoice_line_ids': [(0, 0, {
                    'name': 'Computer SC234',
                    'price_unit': 450.0,
                    'quantity': 1.0,
                    'product_id': self.ref('product.product_product_3'),
                    'uom_id': self.ref('product.product_uom_unit'),
                    'partner_id': self.ref('base.res_partner_12')
                })]
            })
        print('hello \n \n \n')

    def test_00_cancel_purchase_order_flow(self):
        """hello"""
        print('hello')
        # self.assertEqual(self.account_invoice_state, 'draft', 'Account: Invoice state should be "Account"')
