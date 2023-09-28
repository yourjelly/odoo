# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
import json
import re
import requests
from datetime import datetime

from odoo import api, fields, models, _
from odoo.exceptions import UserError

class AccountMoveSend(models.TransientModel):
    _inherit = 'account.move.send'

    checkbox_send_l10n_ke_oscu = fields.Boolean(
        string='Send to OSCU',
        help='Send the invoice ',
    )

    def _get_default_l10n_ke_edi_oscu_enable(self, move):
        return (
            not move.invoice_pdf_report_id \
            # and move.l10n_mx_edi_is_cfdi_needed \
            # and move.l10n_mx_edi_cfdi_state not in ('sent', 'global_sent')
        )

    def _get_wizard_values(self):
        # EXTENDS 'account'
        values = super()._get_wizard_values()
        values['l10n_ke_oscu'] = self.checkbox_send_l10n_ke_oscu
        return values

    # -------------------------------------------------------------------------
    # BUSINESS ACTIONS
    # -------------------------------------------------------------------------

    @api.model
    def _call_web_service_before_invoice_pdf_render(self, invoices_data):
        # EXTENDS 'account'
        super()._call_web_service_before_invoice_pdf_render(invoices_data)
        for invoice, invoice_data in invoices_data.items():
            if (
                    invoice_data.get('l10n_ke_oscu') and
                    self._get_default_l10n_ke_edi_oscu_enable(invoice)
            ):
                invoice.action_l10n_ke_oscu_send()

                # # Check for error.
                # errors = []
                # for document in invoice.l10n_mx_edi_invoice_document_ids:
                #     if document.state == 'invoice_sent_failed':
                #         errors.append(document.message)
                #         break

                # invoice_data['error'] = {
                #     'error_title': _("Error when sending the CFDI to the PAC:"),
                #     'errors': errors,
                # }

                if self._can_commit():
                    self._cr.commit()
