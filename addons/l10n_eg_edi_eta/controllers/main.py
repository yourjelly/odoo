# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.


from odoo import http, _
from odoo.http import request

import logging

_logger = logging.getLogger(__name__)


class EinvoiceIntegration(http.Controller):

    @http.route('/l10n_eg_invoice/get_invoice/<int:invoice_id>', auth='user', type='json', methods=['GET'], cors='*')
    def get_invoice(self, invoice_id, **kwargs):
        try:
            invoice_id = request.env['account.move'].browse(invoice_id)
            if invoice_id:
                eta_invoice = request.env['account.edit.format']._l10n_eg_eta_prepare_eta_invoice(invoice_id)
                eta_invoice.pop('signatures', None)
                return {'data': eta_invoice}
            else:
                return {'errors': _('Invalid Invoice ID !')}
        except Exception as e:
            return {'errors': [{'code': 500, 'msg': str(e)}]}

    @http.route('/l10n_eg_invoice/sign_invoice/<int:invoice_id>', auth='user', type='json', methods=['POST'], cors='*')
    def sign_invoice(self, invoice_id, signatures, **kwargs):

        if not signatures:
            return {'errors': _('Signatures Is Mandatory !')}

        try:
            invoice_id = request.env['account.move'].browse(invoice_id)
            if invoice_id:
                signature = signatures[0]
                invoice_id.write({
                    'l10n_eg_signature_type': str(signature.get('signatureType')),
                    'l10n_eg_signature_data': str(signature.get('value')),
                    'l10n_eg_invoice_signed': True,
                })
                return {'data': {'result': 'Success'}}
            else:
                return {'errors': _('Invalid Invoice ID!')}
        except Exception as e:
            return {'errors': str(e)}
