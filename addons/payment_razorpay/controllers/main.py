# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
import pprint
import werkzeug

from odoo import http, _
from odoo.http import request

_logger = logging.getLogger(__name__)


class RazorpayController(http.Controller):

    @http.route(['/payment/razorpay/capture'], type='http', auth='public', csrf=False)
    def razorpay_capture(self, **kwargs):
        payment_id = kwargs.get('payment_id')
        if payment_id:
            response = request.env['payment.transaction'].sudo()._create_razorpay_capture(kwargs)
            if response.get('id'):
                _logger.info('Razorpay: entering form_feedback with post data %s', pprint.pformat(response))
                request.env['payment.transaction'].sudo().form_feedback(response, 'razorpay')
        return '/payment/process'

    @http.route(['/payment/razorpay/feedback'], type='http', auth='none', csrf=False)
    def razorpay_form_feedback(self, **post):
        _logger.info('Beginning form_feedback with post data %s', pprint.pformat(post))  # debug
        request.env['payment.transaction'].sudo().form_feedback(post, 'razorpay')
        return werkzeug.utils.redirect('/payment/process')

    @http.route(['/payment/razorpay/notify'], type='json', auth='none', csrf=False)
    def razorpay_payment_notify(self, **post):
        try:
            response = request.jsonrequest
            if response.get('payload'):
                request.env['payment.transaction'].sudo()._create_razorpay_notify(response)
        except Exception as e:
            _logger.exception(_("Error while process payment in Razorpay: %s" % str(e)))
        return True
