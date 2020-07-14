# -*- coding: utf-8 -*-
import logging
import requests
import urllib.parse
import werkzeug

from odoo import http
from odoo.http import request

_logger = logging.getLogger(__name__)


class AdyenByOdooController(http.Controller):
    _return_url = '/payment/adyen_by_odoo/return'
    _notify_url = '/payment/adyen_by_odoo/notify'


    @http.route('/payment/adyen_by_odoo/get_payment_methods', type='json', auth='public')
    def get_payment_methods(self, acquirer_id, **kwargs):
        """Fetch the available payment methods for the current payment flow."""
        acquirer = request.env['payment.acquirer'].browse(int(acquirer_id))
        res = acquirer._o_adyen_get_payment_methods(**kwargs)
        return res

    @http.route('/payment/adyen_by_odoo/submit_payment', type='json', auth='public')
    def process_payment(self, adyen_data, acquirer_id, tx_reference, tx_signature, **kwargs):
        acquirer = request.env['payment.acquirer'].browse(int(acquirer_id))
        res = acquirer._odoo_by_adyen_process_payment(adyen_data, acquirer_id, tx_reference, tx_signature, **kwargs)
        return res

    @http.route('/payment/adyen_by_odoo/get_payment_details', type='json', auth='public')
    def get_payment_details(self, acquirer_id, adyen_data, tx_reference, **kwargs):
        acquirer = request.env['payment.acquirer'].browse(int(acquirer_id))
        res = acquirer._odoo_by_adyen_get_payment_details(adyen_data, tx_reference, **kwargs)
        return res
    
    @http.route('/payment/adyen_by_odoo/return', type='http', auth='public', csrf=False)
    def adyen_redirect_feedback(self, **kwargs):
        # I have no idea where there parameters' names comes from 🤔
        md = urllib.parse.unquote(kwargs.get('MD', ''))
        pares = urllib.parse.unquote(kwargs.get('PaRes', ''))
        tx = request.env['payment.transaction'].sudo().search([('o_adyen_payment_session_id', '=', md)])
        adyen_data = {
            'details': {
                'MD': md,
                'PaRes': pares,
            },
            'paymentData': tx.o_adyen_payment_data,
        }
        tx.acquirer_id._odoo_by_adyen_get_payment_details(adyen_data, tx.reference, **kwargs)
        return werkzeug.utils.redirect('/payment/process')