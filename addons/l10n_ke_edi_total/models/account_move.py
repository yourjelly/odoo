# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import logging
import json

from odoo import api, models, fields, _

_logger = logging.getLogger(__name__)


class AccountMove(models.Model):
    _inherit = 'account.move'

    l10n_ke_qrcode = fields.Char(string="QR Code")
    l10n_ke_json = fields.Char(string="Technical field with the json answer/response.  Put in an attachment afterwards")

    def l10n_ke_set_response_data(self, invoices):
        invoice_dict = json.loads(invoices)
        for inv, response in invoice_dict.items():
            invoice = self.browse(int(inv))
            invoice.l10n_ke_qrcode = response['qrcode']
            total_dict = {'request': json.loads(invoice.l10n_ke_json),
                          'response': response}
            invoice.l10n_ke_json = json.dumps(total_dict)

    def l10n_ke_action_post_send_invoices(self):
        self.l10n_ke_json = self.env['account.edi.format']._l10n_ke_tims_prepare_invoice(self)
        return {
            'type': 'ir.actions.client',
            'tag': 'action_post_send_invoice',
            'params': {
                'invoices': self.l10n_ke_json,
            }
        }
