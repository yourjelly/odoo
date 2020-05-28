# -*- coding: utf-8 -*-
from odoo.tests import tagged, HttpCase, new_test_user
from odoo.addons.payment.tests.common import PaymentAcquirerHttpCommon
from odoo.addons.account.tests.common import create_accounting_minimal_data
from odoo.tools import config
from odoo.addons.payment_sips.controllers.main import SipsController


@tagged('post_install', '-at_install', '-standard', 'external')
class SipsTest(PaymentAcquirerHttpCommon):

    def setUp(self):
        super().setUp()
        self.sips = self.env.ref('payment.payment_acquirer_sips')
        self.sips.write({
            'state': 'test',
            'sips_merchant_id': 'dummy_mid',
            'sips_secret': 'dummy_secret',
        })
        self.notify_url = self._convert_url(SipsController._notify_url)

    def test_10_sips_form_render(self):
        self.assertEqual(self.sips.state, 'test', 'test without test environment')

        # ----------------------------------------
        # Test: button direct rendering
        # ----------------------------------------

        # render the button
        tx = self.env['payment.transaction'].create({
            'acquirer_id': self.sips.id,
            'amount': 100.0,
            'reference': 'SO404',
            'currency_id': self.currency_euro.id,
        })
        self.sips.render('SO404', 100.0, self.currency_euro.id, values=self.buyer_values).decode('utf-8')

    def test_20_sips_form_management(self):
        self.assertEqual(self.sips.state, 'test', 'test without test environment')

        # typical data posted by Sips after client has successfully paid
        sips_post_data = {
            'Data': 'captureDay=0|captureMode=AUTHOR_CAPTURE|currencyCode=840|'
                    'merchantId=002001000000001|orderChannel=INTERNET|'
                    'responseCode=00|transactionDateTime=2020-04-08T06:15:59+02:00|'
                    'transactionReference=SO100x1|keyVersion=1|'
                    'acquirerResponseCode=00|amount=31400|authorisationId=0020000006791167|'
                    'paymentMeanBrand=IDEAL|paymentMeanType=CREDIT_TRANSFER|'
                    'customerIpAddress=127.0.0.1|returnContext={"return_url": '
                    '"/payment/process", "reference": '
                    '"SO100x1"}|holderAuthentRelegation=N|holderAuthentStatus=|'
                    'transactionOrigin=INTERNET|paymentPattern=ONE_SHOT|customerMobilePhone=null|'
                    'mandateAuthentMethod=null|mandateUsage=null|transactionActors=null|'
                    'mandateId=null|captureLimitDate=20200408|dccStatus=null|dccResponseCode=null|'
                    'dccAmount=null|dccCurrencyCode=null|dccExchangeRate=null|'
                    'dccExchangeRateValidity=null|dccProvider=null|'
                    'statementReference=SO100x1|panEntryMode=MANUAL|walletType=null|'
                    'holderAuthentMethod=NO_AUTHENT_METHOD',
            'Encode': '',
            'InterfaceVersion': 'HP_2.4',
            'locale': 'en'
        }
        sips_post_data['Seal'] = self.sips._sips_generate_shasign(sips_post_data)

        tx = self.env['payment.transaction'].create({
            'amount': 314.0,
            'acquirer_id': self.sips.id,
            'currency_id': self.currency_euro.id,
            'reference': 'SO100x1',
            'partner_name': 'Norbert Buyer',
            'partner_country_id': self.country_france.id})

        # validate it in POST
        response = self.opener.post(self.notify_url, data=sips_post_data)
        self.assertEqual(response.status_code, 200)

        self.env['base'].flush()
        self.env['base'].invalidate_cache()
        self.assertEqual(tx.state, 'done', 'Sips: validation did not put tx into done state')
        self.assertEqual(tx.acquirer_reference, 'SO100x1', 'Sips: validation did not update tx id')
        
        # same process for an payment in error on sips's end
        sips_post_data = {
            'Data': 'captureDay=0|captureMode=AUTHOR_CAPTURE|currencyCode=840|'
                    'merchantId=002001000000001|orderChannel=INTERNET|responseCode=12|'
                    'transactionDateTime=2020-04-08T06:24:08+02:00|transactionReference=SO100x2|'
                    'keyVersion=1|amount=31400|customerIpAddress=127.0.0.1|returnContext={"return_url": '
                    '"/payment/process", "reference": '
                    '"SO100x2"}|paymentPattern=ONE_SHOT|customerMobilePhone=null|mandateAuthentMethod=null|'
                    'mandateUsage=null|transactionActors=null|mandateId=null|captureLimitDate=null|'
                    'dccStatus=null|dccResponseCode=null|dccAmount=null|dccCurrencyCode=null|'
                    'dccExchangeRate=null|dccExchangeRateValidity=null|dccProvider=null|'
                    'statementReference=SO100x2|panEntryMode=null|walletType=null|holderAuthentMethod=null',
            'InterfaceVersion': 'HP_2.4',
            'Seal': '6e1995ea5432580860a04d8515b6eb1507996f97b3c5fa04fb6d9568121a16a2'
        }
        sips_post_data['Seal'] = self.sips._sips_generate_shasign(sips_post_data)
        tx = self.env['payment.transaction'].create({
            'amount': 314.0,
            'acquirer_id': self.sips.id,
            'currency_id': self.currency_euro.id,
            'reference': 'SO100x2',
            'partner_name': 'Norbert Buyer',
            'partner_country_id': self.country_france.id})
        response = self.opener.post(self.notify_url, data=sips_post_data)
        self.assertEqual(response.status_code, 200)
        # check state
        self.env['base'].flush()
        self.env['base'].invalidate_cache()
        self.assertEqual(tx.state, 'cancel', 'Sips: erroneous validation did not put tx into error state')

    def test_30_sips_badly_formatted_date(self):
        self.assertEqual(self.sips.state, 'test', 'test without test environment')

        # typical data posted by Sips after client has successfully paid
        bad_date = '2020-04-08T06:15:59+56:00'
        sips_post_data = {
            'Data': 'captureDay=0|captureMode=AUTHOR_CAPTURE|currencyCode=840|'
                    'merchantId=002001000000001|orderChannel=INTERNET|'
                    'responseCode=00|transactionDateTime=%s|'
                    'transactionReference=SO100x1|keyVersion=1|'
                    'acquirerResponseCode=00|amount=31400|authorisationId=0020000006791167|'
                    'paymentMeanBrand=IDEAL|paymentMeanType=CREDIT_TRANSFER|'
                    'customerIpAddress=127.0.0.1|returnContext={"return_url": '
                    '"/payment/process", "reference": '
                    '"SO100x1"}|holderAuthentRelegation=N|holderAuthentStatus=|'
                    'transactionOrigin=INTERNET|paymentPattern=ONE_SHOT|customerMobilePhone=null|'
                    'mandateAuthentMethod=null|mandateUsage=null|transactionActors=null|'
                    'mandateId=null|captureLimitDate=20200408|dccStatus=null|dccResponseCode=null|'
                    'dccAmount=null|dccCurrencyCode=null|dccExchangeRate=null|'
                    'dccExchangeRateValidity=null|dccProvider=null|'
                    'statementReference=SO100x1|panEntryMode=MANUAL|walletType=null|'
                    'holderAuthentMethod=NO_AUTHENT_METHOD' % (bad_date,),
            'Encode': '',
            'InterfaceVersion': 'HP_2.4',
            'locale': 'en'
        }
        sips_post_data['Seal'] = self.sips._sips_generate_shasign(sips_post_data)

        tx = self.env['payment.transaction'].create({
            'amount': 314.0,
            'acquirer_id': self.sips.id,
            'currency_id': self.currency_euro.id,
            'reference': 'SO100x1',
            'partner_name': 'Norbert Buyer',
            'partner_country_id': self.country_france.id})

        # validate it
        response = self.opener.post(self.notify_url, data=sips_post_data)
        self.assertEqual(response.status_code, 200)
        self.env['base'].flush()
        self.env['base'].invalidate_cache()
        self.assertEqual(tx.state, 'done', 'Sips: validation did not put tx into done state when date format was weird')

    def _convert_url(self, url):
        assert url.startswith('/')
        port = config['http_port']
        host = '127.0.0.1'
        return f"http://{host}:{port}{url}"