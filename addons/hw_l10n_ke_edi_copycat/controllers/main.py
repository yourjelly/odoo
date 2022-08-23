# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import logging
import json
import requests

from passlib.context import CryptContext

from odoo import http
from odoo.tools.config import config

_logger = logging.getLogger(__name__)

crypt_context = CryptContext(schemes=['pbkdf2_sha512'])

class CopycatController(http.Controller):

    def _is_access_token_valid(self, access_token):
        stored_hash = config.get('proxy_access_token')
        if not stored_hash:
            # empty password/hash => authentication forbidden
            return False
        return crypt_context.verify(access_token, stored_hash)

    @http.route('/hw_l10n_ke_edi_copycat/forward', type='http', auth='none', cors='*', csrf=False, save_session=False, methods=['POST'])
    def copycat_send(self, access_token, device_url, invoice, invoice_id): #TODO: access_token later
        """
        @param access_token: token shared with the main odoo instance
        """
        #if not self._is_access_token_valid(access_token):
        #    return self._get_error_template('unauthorized')

        # Make connection
        invoice_dict = json.loads(invoice)
        response = requests.post(device_url, json=invoice_dict, verify=False)

        response_dict = {
            **json.loads(response.text),
            'invoice_id': invoice_id,
            'systemSigningDate': response.headers['Date'],
        }
        return json.dumps(response_dict)

    def _get_error_template(self, error_str):
        return json.dumps({
            'error': error_str,
        })
