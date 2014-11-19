# -*- coding: utf-8 -*-
import unittest2
from lxml import etree

import openerp
from openerp.tools.misc import mute_logger
from openerp.tests import common

class test_AccountInvoiceTaxincluded(common.TransactionCase):
    """
    Check that if you sell a product with tax included,
    the total amount of the invoice is the price of the product
    """
    
    def setUp(self):
        super(test_AccountInvoiceTaxincluded, self).setUp()
        self.account_tax_model = self.registry('account.tax')
        self.account_invoice_model = self.registry('account.invoice')
        self.account_invoice_line_model = self.registry('account.invoice.line')

        self.partner_agrolait_id = self.registry("ir.model.data").get_object_reference(self.cr, self.uid, "base", "res_partner_2")[1]
        self.currency_eur_id = self.registry("ir.model.data").get_object_reference(self.cr, self.uid, "base", "EUR")[1]
        self.account_rcv_id = self.registry("ir.model.data").get_object_reference(self.cr, self.uid, "account", "a_recv")[1]
        self.product_id = self.registry("ir.model.data").get_object_reference(self.cr, self.uid, "product", "product_product_4")[1]

        self.taxes= {}
        self._set_test_taxes()

    def _set_test_taxes(self):
        self.taxes['tax12inc'] = self.account_tax_model.create(self.cr, self.uid, {
            'name': 'tax12inc',
            'type_tax_use': 'sale',
            'active': 'true',
            'type': 'percent',
            'amount': '0.12',
            'sequence': 1,
            'price_include': 1,
            })
        self.taxes['tax6inc'] = self.account_tax_model.create(self.cr, self.uid, {
            'name': 'tax6inc',
            'type_tax_use': 'sale',
            'active': 'true',
            'type': 'percent',
            'amount': '0.06',
            'sequence': 1,
            'price_include': 1,
            })

    def _set_decimal_accuracy(self, accuracy, rounding):
        self.registry("decimal.precision").write(self.cr, self.uid, self.registry("ir.model.data").get_object_reference(self.cr, self.uid, "product", "decimal_price")[1], {'digits':accuracy})
        self.registry("decimal.precision").write(self.cr, self.uid, self.registry("ir.model.data").get_object_reference(self.cr, self.uid, "product", "decimal_account")[1], {'digits':6})
        self.registry("res.currency").write(self.cr, self.uid, self.currency_eur_id, {'accuracy':accuracy, "rounding": rounding})
        try:
            self.registry("decimal.precision").write(self.cr, self.uid, self.registry("ir.model.data").get_object_reference(self.cr, self.uid, "product", "decimal_account")[1], {'digits':accuracy})
        except Exception, e:
            self.registry("decimal.precision").write(self.cr, self.uid, self.registry("ir.model.data").get_object_reference(self.cr, self.uid, "product", "decimal_account")[1], {'digits':accuracy+1})

    def test_taxincludedprice_12prc(self):
        decimal_accuracies = ((2, '0.01'), (3, '0.001'), (4, '0.0001'), (4, '0.01'))
        for decimal_accuracy in decimal_accuracies:
            self._set_decimal_accuracy(decimal_accuracy[0], decimal_accuracy[1])
            invoice_id = self.account_invoice_model.create(self.cr, self.uid, {'partner_id': self.partner_agrolait_id,
                'reference_type': 'none',
                'currency_id': self.currency_eur_id,
                'name': 'invoice to client',
                'account_id': self.account_rcv_id,
                'type': 'out_invoice',
                })
            self.account_invoice_line_model.create(self.cr, self.uid, {'product_id': self.product_id,
                'quantity': 1,
                'price_unit': 14.70,
                'invoice_id': invoice_id,
                'invoice_line_tax_id': [(6, 0, [self.taxes['tax12inc'],])],
                'name': 'product that cost 14.70 ATI',
            })
            self.account_invoice_model.button_reset_taxes(self.cr, self.uid, invoice_id)
            inv = self.account_invoice_model.browse(self.cr, self.uid, invoice_id)
            self.assertEqual(14.70, round(inv.amount_total,2) , "Total = price of the unique product with tax included at the accuracy %s, rounding %s" % decimal_accuracy)
            self.assertEqual(14.70, round(inv.amount_untaxed + inv.amount_tax,2) , "Total = untaxed amount + taxes at the accuracy %s, rounding %s" % decimal_accuracy)

    def test_taxincludedprice_6prc(self):
        decimal_accuracies = ((2, '0.01'), (3, '0.001'), (4, '0.0001'), (4, '0.01'))
        for decimal_accuracy in decimal_accuracies:
            self._set_decimal_accuracy(decimal_accuracy[0], decimal_accuracy[1])
            invoice_id = self.account_invoice_model.create(self.cr, self.uid, {'partner_id': self.partner_agrolait_id,
                'reference_type': 'none',
                'currency_id': self.currency_eur_id,
                'name': 'invoice to client',
                'account_id': self.account_rcv_id,
                'type': 'out_invoice',
                })
            self.account_invoice_line_model.create(self.cr, self.uid, {'product_id': self.product_id,
                'quantity': 0.962,
                'price_unit': 15.63,
                'invoice_id': invoice_id,
                'invoice_line_tax_id': [(6, 0, [self.taxes['tax6inc'],])],
                'name': 'product that cost 15.63/Kg ATI',
            })
            self.account_invoice_model.button_reset_taxes(self.cr, self.uid, invoice_id)
            inv = self.account_invoice_model.browse(self.cr, self.uid, invoice_id)
            self.assertEqual(round(inv.amount_total, decimal_accuracy[0]), round(inv.amount_untaxed + inv.amount_tax, decimal_accuracy[0]) , "Total = untaxed amount + taxes at the accuracy %s, rounding %s" % decimal_accuracy)
            self.assertEqual(15.04, round(inv.amount_total,2) , "Total = price of the unique product with tax included at the accuracy %s, rounding %s" % decimal_accuracy)
            self.assertEqual(15.04, round(inv.amount_untaxed + inv.amount_tax,2) , " price of the unique product with tax included = untaxed amount + taxes at the accuracy %s, rounding %s" % decimal_accuracy)
