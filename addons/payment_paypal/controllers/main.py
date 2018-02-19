# -*- coding: utf-8 -*-

import json
import logging
import pprint

import requests
import werkzeug
from werkzeug import urls

from odoo import http
from odoo.addons.payment.models.payment_acquirer import ValidationError
from odoo.http import request

_logger = logging.getLogger(__name__)


class PaypalController(http.Controller):
    _notify_url = '/payment/paypal/ipn/'
    _return_url = '/payment/paypal/dpn/'
    _cancel_url = '/payment/paypal/cancel/'

    def _get_return_url(self, **post):
        """ Extract the return URL from the data coming from paypal. """
        return_url = post.pop('return_url', '')
        if not return_url:
            custom = json.loads(urls.url_unquote_plus(post.pop('custom', False) or post.pop('cm', False) or '{}'))
            return_url = custom.get('return_url', '/')
        return return_url

    def _parse_pdt_response(self, response):
        """ Parse a text response for a PDT verification.

            :param str response: text response, structured in the following way:
                STATUS\nkey1=value1\nkey2=value2...\n
             or STATUS\nError message...\n
            :rtype tuple(str, dict)
            :return: tuple containing the STATUS str and the key/value pairs
                     parsed as a dict
        """
        lines = [line for line in response.split('\n') if line]
        status = lines.pop(0)

        pdt_post = {}
        for line in lines:
            split = line.split('=', 1)
            if len(split) == 2:
                pdt_post[split[0]] = urls.url_unquote_plus(split[1])
            else:
                _logger.warning('Paypal: error processing pdt response: %s', line)

        return status, pdt_post

    def paypal_validate_data(self, **post):
        """ Paypal IPN: three steps validation to ensure data correctness

         - step 1: return an empty HTTP 200 response -> will be done at the end
           by returning ''
         - step 2: POST the complete, unaltered message back to Paypal (preceded
           by cmd=_notify-validate or _notify-synch for PDT), with same encoding
         - step 3: paypal send either VERIFIED or INVALID (single word) for IPN
                   or SUCCESS or FAIL (+ data) for PDT

        Once data is validated, process it. """
        res = False
        new_post = dict(post, cmd='_notify-validate', charset='UTF-8')
        reference = post.get('item_number')
        tx = None
        if reference:
            tx = request.env['payment.transaction'].search([('reference', '=', reference)])
        paypal_urls = request.env['payment.acquirer']._get_paypal_urls(tx and tx.acquirer_id.environment or 'prod')
        pdt_request = bool(new_post.get('amt'))  # check for spefific pdt param
        if pdt_request:
            # this means we are in PDT instead of DPN like before
            # fetch the PDT token
            new_post['at'] = tx and tx.acquirer_id.paypal_pdt_token or ''
            new_post['cmd'] = '_notify-synch'  # command is different in PDT than IPN/DPN
        validate_url = paypal_urls['paypal_form_url']
        urequest = requests.post(validate_url, new_post)
        urequest.raise_for_status()
        resp = urequest.text
        if pdt_request:
            resp, post = self._parse_pdt_response(resp)
        if resp in ['VERIFIED', 'SUCCESS']:
            _logger.info('Paypal: validated data')
            res = request.env['payment.transaction'].sudo().form_feedback(post, 'paypal')
        elif resp in ['INVALID', 'FAIL']:
            _logger.warning('Paypal: answered INVALID/FAIL on data verification')
        else:
            _logger.warning('Paypal: unrecognized paypal answer, received %s instead of VERIFIED/SUCCESS or INVALID/FAIL (validation: %s)' % (resp, 'PDT' if pdt_request else 'IPN/DPN'))
        return res

    @http.route('/payment/paypal/ipn/', type='http', auth='none', methods=['POST'], csrf=False)
    def paypal_ipn(self, **post):
        """ Paypal IPN. 
        
        This route is never called by user, but only by Paypal to validate payment in background.
        The user will always come back in Odoo by the route /payment/paypal/dpn, even if pdt and/or ipn is activated.
        """
        _logger.info('Beginning Paypal IPN form_feedback with post data %s', pprint.pformat(post))  # debug
        try:
            self.paypal_validate_data(**post)
        except ValidationError:
            _logger.exception('Unable to validate the Paypal payment')
        return ''

    @http.route('/payment/paypal/dpn', type='http', auth="none", methods=['POST', 'GET'], csrf=False)
    def paypal_dpn(self, token, item_number, **post):
        """ Paypal DPN 
        
        The user will always come back to this route - pdt/ipn activated or not.
        """
        _logger.info('Beginning Paypal DPN form_feedback with post data %s', pprint.pformat(post))  # debug
        if len(post) == 0: #pdt is not activated - we just redirect user to the confirmation page
            transaction = request.env['payment.transaction'].search([('reference', '=', item_number)])
            if transaction.validate_token(token):
                request.session['sale_transaction_id'] = transaction.id
                return werkzeug.utils.redirect(transaction.paypal_return_url) #we use saved url as paypal doesn't return the return url without pdt
        #pdt is activated: we validate data and redirect user
        return_url = self._get_return_url(**post)
        self.paypal_validate_data(**post)
        return werkzeug.utils.redirect(return_url)

    @http.route('/payment/paypal/cancel', type='http', auth="none", csrf=False)
    def paypal_cancel(self, **post):
        """ When the user cancels its Paypal payment: GET on this route """
        _logger.info('Beginning Paypal cancel with post data %s', pprint.pformat(post))  # debug
        post.update({'payment_status': 'Cancel'}) #write ourself cancel in status post data
        request.env['payment.transaction'].sudo().form_feedback(post, 'paypal')
        return werkzeug.utils.redirect("/shop/payment")

    @http.route('/payment/paypal/wait', type='http', auth="public", website=True)
    def paypal_wait_page(self, **post):
        """ When the user cancels its Paypal payment: GET on this route """
        reference = post.pop('item_number', '')
        return request.env['ir.ui.view'].render_template("payment.wait_page", {
                'reference': reference,
            })

    @http.route('/payment/transaction_status', type='json', auth="public", website=True)
    def payment_get_status(self, **post):
        transaction = request.env['payment.transaction'].browse(request.session.get('sale_transaction_id'))

        #if no more update needed, clear session
        if transaction.state != 'draft':
            request.session.update({
                'sale_order_id': False,
                'sale_transaction_id': False,
                'website_sale_current_pl': False,
            })

        return {
            'recall': transaction.state in ['draft']
        }