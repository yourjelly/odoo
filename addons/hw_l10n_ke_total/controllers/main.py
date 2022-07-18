# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import base64
import logging
import platform
import json

from passlib.context import CryptContext

from odoo import http
from odoo.tools.config import config

_logger = logging.getLogger(__name__)


class TotalUsbController(http.Controller):

    def _is_access_token_valid(self, access_token):
        stored_hash = config.get('proxy_access_token')
        if not stored_hash:
            # empty password/hash => authentication forbidden
            return False
        return crypt_context.verify(access_token, stored_hash)

    @http.route('/hw_l10n_ke_total/send', type='http', auth='none', cors='*', csrf=False, save_session=False, methods=['POST'])
    def tims_send(self, invoices): #TODO: pin, access_token later (be careful because pin means vat number
        """
        Check if the access_token is valid and sign the invoices accessing the usb key with the pin.
        @param pin: pin of the token
        @param access_token: token shared with the main odoo instance
        @param invoices: dictionary of invoices. Keys are invoices ids, value are the base64 encoded binaries to sign
        """
        #if not self._is_access_token_valid(access_token):
        #    return self._get_error_template('unauthorized')

        response_dict = {'invoices': {}}
        invoices_dict = json.loads(invoices)
        for invoice, tims_json in invoices_dict.items():
            response_dict['invoices'] = json.dumps({invoice: {'qrcode': 'blabla',
                                      'cuserial': '0000012'}}) #TODO: need real response and real calls here
        return json.dumps(response_dict)

    def _get_error_template(self, error_str):
        return json.dumps({
            'error': error_str,
        })
