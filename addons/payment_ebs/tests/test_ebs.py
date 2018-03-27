# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from lxml import objectify
from werkzeug import urls

from odoo.addons.payment.tests.common import PaymentAcquirerCommon
from odoo.tests import tagged


class EbsCommon(PaymentAcquirerCommon):

    def setUp(self):
        super(EbsCommon, self).setUp()
        self.ebs = self.env.ref('payment.payment_acquirer_ebs')
        self.currency_usd = self.env['res.currency'].search([('name', '=', 'USD')], limit=1)


@tagged('post_install', '-at_install', 'external', '-standard')
class EbsForm(EbsCommon):

    def test_10_ebs_form_render(self):
        base_url = self.env['ir.config_parameter'].get_param('web.base.url')
        self.assertEqual(self.ebs.environment, 'test', 'test without test environment')
        self.ebs.write({
            'ebs_account_id': 'dummy',
            'ebs_secret_key': 'dummy'
        })

        # ----------------------------------------
        # Test: button direct rendering
        # ----------------------------------------
        self.env['payment.transaction'].create({
            'reference': 'test_ref0',
            'amount': 0.01,
            'currency_id': self.currency_euro.id,
            'acquirer_id': self.ebs.id,
            'partner_id': self.buyer_id
        })

        # render the button
        res = self.ebs.render(
            'test_ref0', 0.01, self.currency_euro.id,
            values=self.buyer_values)

        form_values = {
            'channel': '0',
            'account_id': self.ebs.ebs_account_id,
            'reference_no': 'test_ref0',
            'amount': '0.01',
            'mode': 'LIVE' if self.ebs.environment == 'prod' else 'TEST',
            'currency': 'INR',
            'description': 'payment from ecommerce',
            'return_url': urls.url_join(base_url, '/payment/ebs/return/?redirect_url=None'),
            'name': 'Norbert Buyer',
            'address': 'Huge Street 2/543',
            'city': 'Sin City',
            'country': 'BE',
            'postal_code': '1000',
            'phone': '0032 12 34 56 78',
            'email': 'norbert.buyer@example.com',
        }
        # check form result
        tree = objectify.fromstring(res)

        data_set = tree.xpath("//input[@name='data_set']")
        self.assertEqual(len(data_set), 1, 'ebs: Found %d "data_set" input instead of 1' % len(data_set))
        self.assertEqual(data_set[0].get('data-action-url'), 'https://secure.ebs.in/pg/ma/payment/request', 'ebs: wrong form POST url')
        for form_input in tree.input:
            if form_input.get('name') in ['submit', 'data_set', 'secure_hash']:
                continue
            self.assertEqual(
                form_input.get('value'),
                form_values[form_input.get('name')],
                'ebs: wrong value for input %s: received %s instead of %s' % (form_input.get('name'), form_input.get('value'), form_values[form_input.get('name')])
            )

    def test_20_ebs_form_management(self):
        self.assertEqual(self.ebs.environment, 'test', 'test without test environment')

        # typical data posted by ebs after client has successfully paid
        ebs_post_data = {
           'ResponseCode': '2',
           'ResponseMessage': 'canceled',
           'DateCreated': '2018-06-28',
           'PaymentID': '123456',
           'MerchantRefNo': 'test_ref_2',
           'Amount': 0.01,
           'Mode': 'TEST',
           'TransactionID': '123456',
           'SecureHash': 'F6D1C22170B1A30300244190B20725E2',
           'AccountID': self.ebs.ebs_account_id,
        }

        # create tx
        tx = self.env['payment.transaction'].create({
            'amount': 0.01,
            'acquirer_id': self.ebs.id,
            'currency_id': self.currency_euro.id,
            'reference': 'test_ref_2',
            'partner_name': 'Norbert Buyer',
            'partner_country_id': self.country_france.id,
            'partner_id': self.buyer_id})

        # validate transaction
        tx.form_feedback(ebs_post_data, 'ebs')
        # check
        self.assertEqual(tx.state, 'cancel', 'ebs: wrong state after receiving a valid pending notification')
        self.assertEqual(tx.state_message, 'canceled', 'ebs: wrong state message after receiving a valid pending notification')
        self.assertEqual(tx.acquirer_reference, '123456', 'PayUlatam: wrong txn_id after receiving a valid pending notification')

        # update transaction
        tx.write({
            'state': 'draft',
            'acquirer_reference': False})

        # update notification from ebs
        ebs_post_data.update({
            'ResponseCode': '0',
            'SecureHash': '82AB4ECB29FA0AF81642B7B44F5556AC'})

        # validate transaction
        tx.form_feedback(ebs_post_data, 'ebs')
        # check transaction
        self.assertEqual(tx.state, 'done', 'ebs: wrong state after receiving a valid pending notification')
        self.assertEqual(tx.acquirer_reference, '123456', 'ebs: wrong txn_id after receiving a valid pending notification')
