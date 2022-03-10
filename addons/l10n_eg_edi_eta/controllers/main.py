# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import hashlib
import hmac
import json
import time
from odoo import http, _
from odoo.http import request
from odoo.tools import consteq

import logging

_logger = logging.getLogger(__name__)


class EinvoiceIntegration(http.Controller):

    def _is_token_valid(self, token, invoices):

        if not token:
            return False

        try:
            hm, _, max_ts = str(token).rpartition('o')
        except UnicodeEncodeError:
            return False

        if max_ts:
            try:
                if int(max_ts) < int(time.time()):
                    return False
            except ValueError:
                return False

        payload = str(invoices)
        url = request.env['ir.config_parameter'].sudo().get_param('web.base.url')
        msg = '%s%s%s' % (url, payload, max_ts)
        secret = request.env['ir.config_parameter'].sudo().get_param('database.secret')
        assert secret, "CSRF protection requires a configured database secret"
        hm_expected = hmac.new(secret.encode('ascii'), msg.encode('utf-8'), hashlib.sha256).hexdigest()

        return consteq(hm, hm_expected)

    @http.route('/l10n_eg_invoice/get_invoice', auth='none', type='http', methods=['GET'], cors='*', csrf=False)
    def get_invoice(self, token, invoice_ids, **kwargs):
        invoice_ids = [int(x) for x in invoice_ids.split(',')]
        if not self._is_token_valid(token, invoice_ids):
            return json.dumps({'errors': _('Invalid Token !')})
        try:
            payload = dict()
            invoice_ids = request.env['account.move'].sudo().browse(invoice_ids)
            if not invoice_ids:
                return {'errors': _('Invalid Invoice ID !')}
            for invoice_id in invoice_ids:
                eta_invoice = request.env['account.edi.format']._l10n_eg_eta_prepare_eta_invoice(invoice_id)
                eta_invoice.pop('signatures', None)
                payload[invoice_id.id] = eta_invoice
            return json.dumps(payload)
        except Exception as e:
            return json.dumps({'errors': str(e)})

    @http.route('/l10n_eg_invoice/submit_signed_invoices', auth='none', type='json', methods=['POST'], cors='*', csrf=False)
    def sign_invoice(self, token, invoices, **kwargs):
        inv_list = list(invoices.keys())
        if not self._is_token_valid(token, inv_list):
            return json.dumps({'errors': _('Invalid Token !')})

        try:
            if invoice_id := request.env['account.move'].browse(invoice_id):
                signature = signatures[0]
                invoice_id.write({
                    'l10n_eg_signature_type': str(signature.get('signatureType')),
                    'l10n_eg_signature_data': str(signature.get('value')),
                })
                return {'data': {'result': 'Success'}}
            else:
                return {'errors': _('Invalid Invoice ID!')}
        except Exception as e:
            return json.dumps({'errors': str(e)})
