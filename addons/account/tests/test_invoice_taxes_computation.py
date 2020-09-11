# -*- coding: utf-8 -*-
from odoo.addons.account.tests.test_account_business_line_mixin import TestAccountBusinessLineMixin
from odoo.tests import tagged


@tagged('post_install', '-at_install')
class TestInvoiceTaxesComputation(TestAccountBusinessLineMixin):

    @classmethod
    def _create_business_object(self, line_vals):
        return self.env['account.move'].create({
            'move_type': 'out_invoice',
            'partner_id': self.partner_a.id,
            'invoice_date': '2019-01-01',
            'date': '2019-01-01',
            'invoice_line_ids': [(0, 0, {
                'product_id': self.product_a.id,
                'price_unit': vals['price_unit'],
                'tax_ids': [(6, 0, vals['tax_ids'])],
            }) for vals in line_vals],
        })

    @classmethod
    def _get_totals(cls, business_object):
        return {
            'amount_untaxed': business_object.amount_untaxed,
            'amount_tax': business_object.amount_tax,
            'amount_total': business_object.amount_total,
        }
