# -*- coding: utf-8 -*-
import datetime
import logging

import odoo
from odoo import fields
from odoo.addons.payment.tests.common import PaymentAcquirerCommon
from odoo.tests.common import ChromeBrowserException
from odoo.tools import mute_logger
from odoo.tests import tagged, HttpCase, new_test_user

_logger = logging.getLogger(__name__)


def setupStripe(self):
    self.stripe_customer = new_test_user(self.env, login='stripe_customer')
    self.stripe_customer.password = 'stripe_customer'
    self.stripe = self.env.ref('payment.payment_acquirer_stripe')
    self.stripe.write({
        'stripe_secret_key': 'sk_test_KJtHgNwt2KS3xM7QJPr4O5E8',
        'stripe_publishable_key': 'pk_test_QSPnimmb4ZhtkEy3Uhdm4S6J',
        'state': 'test',
        'payment_flow': 'form',
    })
    self.token = self.env['payment.token'].create({
        'name': 'Test Card',
        'acquirer_id': self.stripe.id,
        'acquirer_ref': 'cus_G27S7FqQ2w3fuH',
        'stripe_payment_method': 'pm_1FW3DdAlCFm536g8eQoSCejY',
        'partner_id': self.stripe_customer.partner_id.id,
        'verified': True,
    })


@tagged('post_install', '-at_install', '-standard', 'external')
class StripeTest(PaymentAcquirerCommon):

    def setUp(self):
        super().setUp()
        setupStripe(self)

    def test_10_stripe_s2s(self):
        self.assertEqual(self.stripe.state, 'test', 'test without test environment')
        # Create transaction
        tx = self.env['payment.transaction'].create({
            'reference': 'stripe_test_10_%s' % fields.datetime.now().strftime('%Y%m%d_%H%M%S'),
            'currency_id': self.currency_euro.id,
            'acquirer_id': self.stripe.id,
            'partner_id': self.buyer_id,
            'payment_token_id': self.token.id,
            'type': 'server2server',
            'amount': 115.0
        })
        tx.with_context(off_session=True).stripe_s2s_do_transaction()

        # Check state
        self.assertEqual(tx.state, 'done', 'Stripe: Transcation has been discarded.')

    def test_20_stripe_form_render(self):
        self.assertEqual(self.stripe.state, 'test', 'test without test environment')

        # ----------------------------------------
        # Test: button direct rendering
        # ----------------------------------------

        # render the button
        self.stripe.render('SO404', 320.0, self.currency_euro.id, values=self.buyer_values).decode('utf-8')

    def test_30_stripe_form_management(self):
        self.assertEqual(self.stripe.state, 'test', 'test without test environment')
        ref = 'stripe_test_30_%s' % fields.datetime.now().strftime('%Y%m%d_%H%M%S')
        tx = self.env['payment.transaction'].create({
            'amount': 4700.0,
            'acquirer_id': self.stripe.id,
            'currency_id': self.currency_euro.id,
            'reference': ref,
            'partner_name': 'Norbert Buyer',
            'partner_country_id': self.country_france.id,
            'payment_token_id': self.token.id,
        })
        res = tx.with_context(off_session=True)._stripe_create_payment_intent()
        tx.stripe_payment_intent = res.get('payment_intent')

        # typical data posted by Stripe after client has successfully paid
        stripe_post_data = {'reference': ref}
        # validate it
        tx.form_feedback(stripe_post_data, 'stripe')
        self.assertEqual(tx.state, 'done', 'Stripe: validation did not put tx into done state')
        self.assertEqual(tx.acquirer_reference, stripe_post_data.get('id'), 'Stripe: validation did not update tx id')


# Buckle up kids, we're going on an adventure!
# Since Stripe will either redirect to Checkout or open iframes which
# the tour helpers can't interact with because of a strong same-origin
# policy, we're gonna drive the Chrome browser directly
@tagged('post_install', '-at_install', 'external')
class TestUi(HttpCase):

    def setUp(self):
        super().setUp()
        setupStripe(self)

    def test_01_stripe_checkout(self):
        return
        PORT = odoo.tools.config['http_port']
        HOST = '127.0.0.1'
        base_url = "http://%s:%s" % (HOST, PORT)
        now = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
        tx_name = 'stripe-test-{now}'.format(now=now)
        self.start_browser()
        chrome = self.browser

        def click(selector):
            _logger.info('ChromeBrowser: clicking on element with selector %s', selector)
            found_elem = chrome._wait_ready("Boolean(document.querySelectorAll('%s').length)" % selector)
            if not found_elem:
                raise ChromeBrowserException('could not click as element was not found in page')
            _logger.info('ChromeBrowser: element found, clicking')
            cmd_id = chrome._websocket_send('DOM.getDocument')
            doc = chrome._websocket_wait_id(cmd_id)
            root_node_id = doc['result']['root']['nodeId']
            cmd_id = chrome._websocket_send('DOM.querySelector', params={'nodeId': root_node_id, 'selector': selector})
            elem = chrome._websocket_wait_id(cmd_id)
            node_id = elem['result']['nodeId']
            cmd_id = chrome._websocket_send('DOM.getBoxModel', params={'nodeId': node_id})
            box = chrome._websocket_wait_id(cmd_id)
            # get click coordinates (center of the target node)
            (tx, ty) = (box['result']['model']['content'][0],box['result']['model']['content'][1])
            width = box['result']['model']['width']
            height = box['result']['model']['height']
            (x, y) = (tx + width/2, ty + height/2)
            
            # mouse events are, for some reason, super slow sometimes - allow a greater timeout for those
            cmd_id = chrome._websocket_send('Input.dispatchMouseEvent', params={'type': 'mousePressed', 'button': 'left', 'x': x, 'y': y, 'clickCount': 1})
            chrome._websocket_wait_id(cmd_id)
            cmd_id = chrome._websocket_send('Input.dispatchMouseEvent', params={'type': 'mouseReleased', 'button': 'left', 'x': x, 'y': y, 'clickCount': 1})
            chrome._websocket_wait_id(cmd_id)
            _logger.info('ChromeBrowser: click dispatched')

        def inputType(char):
            _logger.info('Sending keyboard text: %s', char)
            for letter in char:
                cmd_id = chrome._websocket_send('Input.dispatchKeyEvent', params={'type': 'keyDown', 'text': letter})
                chrome._websocket_wait_id(cmd_id)
                cmd_id = chrome._websocket_send('Input.dispatchKeyEvent', params={'type': 'keyUp'})
                chrome._websocket_wait_id(cmd_id)

        def pressKey(key):
                cmd_id = chrome._websocket_send('Input.dispatchKeyEvent', params={'type': 'keyDown', 'key': key})
                chrome._websocket_wait_id(cmd_id)
                cmd_id = chrome._websocket_send('Input.dispatchKeyEvent', params={'type': 'keyUp', 'key': key})
                chrome._websocket_wait_id(cmd_id)

        self.authenticate('stripe_customer', 'stripe_customer')
        url = '{base_url}/website_payment/pay?amount=100&currency_id=1&reference={tx_name}'.format(base_url=base_url, tx_name=tx_name)
        chrome.navigate_to(url, wait_stop=True)
        chrome.take_screenshot()
        chrome.start_screencast()
        # select Stripe, submit payment - this will redirect to checkout
        click('input[data-provider="stripe"]')
        click('button#o_payment_form_pay')
        chrome.take_screenshot()
        # land on checkout.stripe.com
        chrome._wait_ready("document.location.hostname === 'checkout.stripe.com'")
        # fill in card info
        click('input#cardNumber')
        inputType('4111111111111111')
        pressKey('Tab')
        expiry = (datetime.date.today() + datetime.timedelta(days=180)).strftime('%m%y')
        inputType(expiry)
        pressKey('Tab')
        inputType('123')
        pressKey('Tab')
        inputType('Stripe Customer')
        # submit payment, will redirect to Odoo
        click('button.SubmitButton--complete')
        chrome.take_screenshot()
        # and now we're going back to Odoo
        chrome._wait_ready("document.location.hostname === '127.0.0.1'")
        chrome._wait_ready("document.location.pathname === '/website_payment/confirm'")
        chrome._wait_ready("Boolean(document.querySelectorAll('.o_website_payment .alert-success').length)")
        tx = self.env['payment.transaction'].search([('reference', 'like', tx_name), ('state', '=', 'done')])
        self.assertTrue(tx, 'Cannot find validated transaction')
        chrome.take_screenshot()
        chrome.stop_screencast(prefix='stripe_test_checkout')
        # clear up the browser
        self.browser.delete_cookie('session_id', domain=HOST)
        self.browser.clear()
        self._wait_remaining_requests()

    def test_02_stripe_elements(self):
        self.stripe.payment_flow = 's2s'
        PORT = odoo.tools.config['http_port']
        HOST = '127.0.0.1'
        base_url = "http://%s:%s" % (HOST, PORT)
        now = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
        tx_name = 'stripe-test-{now}'.format(now=now)
        self.start_browser()
        chrome = self.browser

        def click(selector, debug=False):
            _logger.info('ChromeBrowser: clicking on element with selector %s', selector)
            """ found_elem = chrome._wait_ready("Boolean(document.querySelectorAll('%s').length)" % selector)
            if not found_elem:
                raise ChromeBrowserException('could not click as element was not found in page') """
            _logger.info('ChromeBrowser: element found, clicking')
            cmd_id = chrome._websocket_send('DOM.getDocument')
            doc = chrome._websocket_wait_id(cmd_id)
            root_node_id = doc['result']['root']['nodeId']
            cmd_id = chrome._websocket_send('DOM.querySelector', params={'nodeId': root_node_id, 'selector': selector})
            elem = chrome._websocket_wait_id(cmd_id)
            node_id = elem['result']['nodeId']
            if debug:
                import pudb; pu.db
            cmd_id = chrome._websocket_send('DOM.getBoxModel', params={'nodeId': node_id})
            box = chrome._websocket_wait_id(cmd_id)
            # get click coordinates (center of the target node)
            (tx, ty) = (box['result']['model']['content'][0],box['result']['model']['content'][1])
            width = box['result']['model']['width']
            height = box['result']['model']['height']
            (x, y) = (tx + width/2, ty + height/2)
            
            cmd_id = chrome._websocket_send('Input.dispatchMouseEvent', params={'type': 'mousePressed', 'button': 'left', 'x': x, 'y': y, 'clickCount': 1})
            chrome._websocket_wait_id(cmd_id)
            cmd_id = chrome._websocket_send('Input.dispatchMouseEvent', params={'type': 'mouseReleased', 'button': 'left', 'x': x, 'y': y, 'clickCount': 1})
            chrome._websocket_wait_id(cmd_id)
            _logger.info('ChromeBrowser: click dispatched')

        def inputType(char):
            _logger.info('Sending keyboard text: %s', char)
            for letter in char:
                cmd_id = chrome._websocket_send('Input.dispatchKeyEvent', params={'type': 'keyDown', 'text': letter})
                chrome._websocket_wait_id(cmd_id)
                cmd_id = chrome._websocket_send('Input.dispatchKeyEvent', params={'type': 'keyUp'})
                chrome._websocket_wait_id(cmd_id)

        def pressKey(key):
                cmd_id = chrome._websocket_send('Input.dispatchKeyEvent', params={'type': 'keyDown', 'key': key})
                chrome._websocket_wait_id(cmd_id)
                cmd_id = chrome._websocket_send('Input.dispatchKeyEvent', params={'type': 'keyUp', 'key': key})
                chrome._websocket_wait_id(cmd_id)

        self.authenticate('stripe_customer', 'stripe_customer')
        url = '{base_url}/website_payment/pay?amount=100&currency_id=1&reference={tx_name}'.format(base_url=base_url, tx_name=tx_name)
        chrome.navigate_to(url, wait_stop=True)
        chrome.take_screenshot()
        chrome.start_screencast()
        # select Stripe, submit payment - this will redirect to checkout
        click('input[data-provider="stripe"]')
        import time
        time.sleep(5)
        import pprint
        pprint.pprint(chrome._websocket_wait_id(chrome._websocket_send('DOM.getDocument', params={'pierce': True, 'depth': -1})))
        click('.card-element iframe input[name="cardnumber"]', debug=True)
        # fill in card info
        inputType('4111111111111111')
        expiry = (datetime.date.today() + datetime.timedelta(days=180)).strftime('%m%y')
        inputType(expiry)
        inputType('123')
        # submit payment, will redirect to Odoo
        click('button#o_payment_form_pay')
        chrome.take_screenshot()
        # and now we're going back to Odoo
        chrome._wait_ready("document.location.hostname === '127.0.0.1'")
        chrome._wait_ready("document.location.pathname === '/website_payment/confirm'")
        chrome._wait_ready("Boolean(document.querySelectorAll('.o_website_payment .alert-success').length)")
        tx = self.env['payment.transaction'].search([('reference', 'like', tx_name), ('state', '=', 'done')])
        self.assertTrue(tx, 'Cannot find validated transaction')
        chrome.take_screenshot()
        chrome.stop_screencast(prefix='stripe_test_elements')
        # clear up the browser
        self.browser.delete_cookie('session_id', domain=HOST)
        self.browser.clear()
        self._wait_remaining_requests()