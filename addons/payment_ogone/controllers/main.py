# -*- coding: utf-8 -*-
import json
import logging
import pprint
import werkzeug
from werkzeug.urls import url_unquote_plus

from odoo import http
from odoo.http import request
from odoo.tools import consteq
from odoo.addons.payment.models.payment_acquirer import ValidationError
from odoo.addons.payment.controllers.portal import PaymentProcessing

_logger = logging.getLogger(__name__)


class OgoneController(http.Controller):
    _accept_url = '/payment/ogone/test/accept'
    _decline_url = '/payment/ogone/test/decline'
    _exception_url = '/payment/ogone/test/exception'
    _cancel_url = '/payment/ogone/test/cancel'

    @http.route([
        '/payment/ogone/accept', '/payment/ogone/test/accept',
        '/payment/ogone/decline', '/payment/ogone/test/decline',
        '/payment/ogone/exception', '/payment/ogone/test/exception',
        '/payment/ogone/cancel', '/payment/ogone/test/cancel',
    ], type='http', auth='public')
    def ogone_form_feedback(self, **post):
        """ Ogone contacts using GET, at least for accept """
        _logger.info('Ogone: entering form_feedback with post data %s', pprint.pformat(post))  # debug
        request.env['payment.transaction'].sudo().form_feedback(post, 'ogone')
        return werkzeug.utils.redirect("/payment/process")

    @http.route(['/payment/ogone/s2s/create_json'], type='json', auth='public', csrf=False)
    def ogone_s2s_create_json(self, **kwargs):
        if not kwargs.get('partner_id'):
            kwargs = dict(kwargs, partner_id=request.env.user.partner_id.id)
        new_id = request.env['payment.acquirer'].browse(int(kwargs.get('acquirer_id'))).s2s_process(kwargs)
        return new_id.id

    @http.route(['/payment/ogone/s2s/create_json_3ds'], type='json', auth='public', csrf=False)
    def ogone_s2s_create_json_3ds(self, verify_validity=False, **kwargs):
        if not kwargs.get('partner_id'):
            kwargs = dict(kwargs, partner_id=request.env.user.partner_id.id)
        token = False
        error = None
        
        try:
            token = request.env['payment.acquirer'].browse(int(kwargs.get('acquirer_id'))).s2s_process(kwargs)
        except Exception as e:
            error = str(e)

        if not token:
            res = {
                'result': False,
                'error': error,
            }
            return res

        res = {
            'result': True,
            'id': token.id,
            'short_name': token.short_name,
            '3d_secure': False,
            'verified': False,
        }

        if verify_validity != False:
            baseurl = request.env['ir.config_parameter'].sudo().get_param('web.base.url')
            params = {
                'accept_url': baseurl + '/payment/ogone/validate/accept',
                'decline_url': baseurl + '/payment/ogone/validate/decline',
                'exception_url': baseurl + '/payment/ogone/validate/exception',
                'return_url': kwargs.get('return_url', baseurl)
                }
            tx = token.validate(**params)
            res['verified'] = token.verified

            if tx and tx.html_3ds:
                res['3d_secure'] = tx.html_3ds

        return res

    @http.route(['/payment/ogone/s2s/create'], type='http', auth='public', methods=["POST"], csrf=False)
    def ogone_s2s_create(self, **post):
        error = ''
        acq = request.env['payment.acquirer'].browse(int(post.get('acquirer_id')))
        try:
            token = acq.s2s_process(post)
        except Exception as e:
            # synthax error: 'CHECK ERROR: |Not a valid date\n\n50001111: None'
            token = False
            error = str(e).splitlines()[0].split('|')[-1] or ''

        if token and post.get('verify_validity'):
            baseurl = request.env['ir.config_parameter'].sudo().get_param('web.base.url')
            params = {
                'accept_url': baseurl + '/payment/ogone/validate/accept',
                'decline_url': baseurl + '/payment/ogone/validate/decline',
                'exception_url': baseurl + '/payment/ogone/validate/exception',
                'return_url': post.get('return_url', baseurl)
                }
            tx = token.validate(**params)
            if tx and tx.html_3ds:
                return tx.html_3ds
            # add the payment transaction into the session to let the page /payment/process to handle it
            PaymentProcessing.add_payment_transaction(tx)
        return werkzeug.utils.redirect("/payment/process")

    @http.route([
        '/payment/ogone/validate/accept',
        '/payment/ogone/validate/decline',
        '/payment/ogone/validate/exception',
    ], type='http', auth='public')
    def ogone_validation_form_feedback(self, **post):
        """ Feedback from 3d secure for a bank card validation """
        request.env['payment.transaction'].sudo().form_feedback(post, 'ogone')
        return werkzeug.utils.redirect("/payment/process")

    @http.route(['/payment/ogone/s2s/feedback'], auth='public', csrf=False)
    def feedback(self, **kwargs):
        try:
            tx = request.env['payment.transaction'].sudo()._ogone_form_get_tx_from_data(kwargs)
            tx._ogone_s2s_validate_tree(kwargs)
        except ValidationError:
            return 'ko'
        return 'ok'


    @http.route(['/payment/ogone/s2s/create_3ds',], type='http', auth='public')
    def ogone_alias_gateway_feedback(self, **post):
        """
        Feedback route for Alias Gateway creation.
    
        In the case of a payment, there will be a serialized payment form in the paymentForm
        parameter; in that case we need to redirect to the correct paymentFormAction (e.g. website_sale,
        website_payment, etc) with the paymentForm as GET params.

        In the case of a card registration without payment, then we just need to validate
        the card (if provider set up for it) and redirect at the end.
        """
        _logger.info('Ogone: feeback Alias gateway with post data %s', pprint.pformat(post))  # debug)
        # If you have configured an SHA-OUT passphrase for these feedback requests,
        # you need to take the ALIAS parameter into account for your signature.
        pprint.pformat(post)
        # We have created the token. We can now make the payment and create the transaction.
        card_number_masked = post['CardNo']
        pprint.pformat(post)
        form_values = json.loads(url_unquote_plus(post.get('paymentForm')))
        pspid = form_values.get('PSPID')
        acquirer = request.env['payment.acquirer'].sudo().search([('provider', '=', 'ogone'), ('ogone_pspid', '=', pspid)])
        partner_id = post['partner_id']
        if not partner_id:
            raise ValidationError('payment token must be stored for a specific partner')
        data_clean = {}
        for key, value in post.items():
            data_clean[key.upper()] = value
        shasign = acquirer._ogone_generate_shasign('out', data_clean)
        if not consteq(shasign, post.get('SHASign')):
            _logger.exception('SHA Signature mismatch, feedback rejected')
            raise ValidationError('SHA Signature mismatch, feedback rejected')
        if partner_id:
            token_parameters = {
                'CC_NUMBER': card_number_masked,
                'CC_HOLDER_NAME': data_clean['CN'],
                'CC_EXPIRY': data_clean['ED'],
                'CC_BRAND': data_clean['BRAND'],
                'acquirer_id': acquirer.id,
                'partner_id': partner_id,
                'alias_gateway': True,
                'ALIAS': data_clean['ALIAS'],
            }
            token = request.env['payment.token'].create(token_parameters, )
            baseurl = request.env['ir.config_parameter'].sudo().get_param('web.base.url')
            form_values['pm_id'] = token.id
            form_action = url_unquote_plus(post.get('paymentFormAction'))
            if not form_action:
                return werkzeug.utils.redirect(werkzeug.urls.url_join(baseurl, '/my/payment_method'))  # I hope at least...
            form_url = werkzeug.urls.url_join(baseurl, form_action)
            return werkzeug.utils.redirect("?".join([form_url, werkzeug.urls.url_encode(form_values)]))