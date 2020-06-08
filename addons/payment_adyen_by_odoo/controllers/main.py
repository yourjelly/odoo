# -*- coding: utf-8 -*-
import logging
import requests
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