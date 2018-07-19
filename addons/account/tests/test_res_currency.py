# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo.tests.common import TransactionCase

class TestFloat(TransactionCase):

    def test_rounding_04(self):
        """ check that proper rounding is performed for float persistence """
        currency = self.env.ref('base.EUR')
        currency_rate = self.env['res.currency.rate']

        def try_roundtrip(value, expected, date):
            rate = currency_rate.create({'name': date,
                                         'rate': value,
                                         'currency_id': currency.id})
            self.assertEqual(rate.rate, expected,
                             'Roundtrip error: got %s back from db, expected %s' % (rate, expected))

        # res.currency.rate uses 6 digits of precision by default
        try_roundtrip(2.6748955, 2.674896, '2000-01-01')
        try_roundtrip(10000.999999, 10000.999999, '2000-01-03')

        #TODO re-enable those tests when tests are made on dedicated models
        # (res.currency.rate don't accept negative value anymore)
        #try_roundtrip(-2.6748955, -2.674896, '2000-01-02')
        #try_roundtrip(-10000.999999, -10000.999999, '2000-01-04')

    def test_amount_to_text_10(self):
        """ verify that amount_to_text works as expected """
        currency = self.env.ref('base.EUR')

        amount_target = currency.amount_to_text(0.29)
        amount_test = currency.amount_to_text(0.28)
        self.assertNotEqual(amount_test, amount_target,
                            "Amount in text should not depend on float representation")
