# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo.tests.common import TransactionCase


class TestAccountInvoiceState(TransactionCase):
    def setUp(self):
        super(TestAccountInvoiceState, self).setUp()
        # In order to test Confirm Draft Invoice wizard I create an invoice
        invoice_account = self.env['account.account'].search([('user_type_id', '=', self.env.ref('account.data_account_type_receivable').id)], limit=1).id
        invoice_line_account = self.env['account.account'].search([('user_type_id', '=', self.env.ref('account.data_account_type_expenses').id)], limit=1).id
        self.account_invoice_state = self.env['account.invoice'].create({
            'partner_id': self.env.ref('base.res_partner_12').id,
            'account_id': invoice_account,
            'type': 'in_invoice',
            'company_id': self.ref('base.main_company'),
            'currency_id': self.ref('base.EUR'),
            'invoice_line_ids': [(0, 0, {
                    'name': 'Computer SC234',
                    'account_id': invoice_line_account,
                    'price_unit': 450.0,
                    'quantity': 1.0,
                    'product_id': self.ref('product.product_product_3'),
                    'uom_id': self.ref('product.product_uom_unit'),
                    'partner_id': self.ref('base.res_partner_12')
                })]
        })

    def test_00_account_invoice_state_flow(self):
        """Test Account Invoice State"""
        self.assertEqual(self.account_invoice_state.state, 'draft', 'Account: invoice state is draft')
        # I called the "Confirm Draft Invoices" wizard and I clicked on Confirm Invoices Button
        self.account_invoice_confirm_0 = self.env['account.invoice.confirm']
        self.account_invoice_confirm_0.browse(self.env['account.invoice']).with_context({"lang": 'en_US', "tz": False, "active_model": "account.invoice", "active_ids": [self.account_invoice_state.id], "type": "out_invoice",  "active_id": self.account_invoice_state.id }).invoice_confirm()
        #  I check that customer invoice state is "Open"
        self.assertEqual(self.account_invoice_state.state, 'open', 'Account: invoice state is open')
        #  I check the journal associated and put this journal as not
        moves = self.env['account.move.line'].search([('invoice_id', '=', self.account_invoice_state.id)])
        self.assertGreater(len(moves), 0, 'You should have multiple movies')
        moves[0].journal_id.write({'update_posted': True})
        # In order to check the "Cancel Selected Invoices" wizard in odoo I cancelled this open invoice using this wizard
        self.account_invoice_cancel_0 = self.env['account.invoice.cancel']
        #  I clicked on Cancel Invoices Button
        self.account_invoice_cancel_0.browse(self.env['account.invoice']).with_context({"lang": 'en_US', "tz": False, "active_model": "account.invoice", "active_ids": [self.account_invoice_state.id], "type": "out_invoice",  "active_id": self.account_invoice_state.id }).invoice_cancel()
        #  I check that customer invoice is in the cancel state
        self.assertEqual(self.account_invoice_state.state, 'cancel', 'Account: invoice state is draft')
