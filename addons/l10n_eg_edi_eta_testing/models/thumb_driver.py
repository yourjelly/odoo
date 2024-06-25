# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models, _
import json


class EtaThumbDrive(models.Model):
    _inherit = 'l10n_eg_edi.thumb.drive'


    @api.model
    def action_sign_invoices(self, invoice_ids):
        # function redone, to avoid sending it to our middleware.
        # This should not be used to test the middleware or any JS errors.
        for invoice_id in invoice_ids:
            eta_invoice = json.loads(invoice_id.l10n_eg_eta_json_doc_id.raw)
            eta_invoice['request']['signatures'] = [{'signatureType': 'I', 'value': 'TEST'}]
            invoice_id.l10n_eg_eta_json_doc_id.raw = json.dumps(eta_invoice)
            invoice_id.l10n_eg_is_signed = True