# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import models


class AccountEdiFormat(models.Model):
    _inherit = "account.edi.format"

    def _l10n_in_edi_generate_invoice_json(self, invoice):
        """
            In case of a debit note, we send an EDI as a debit note instead of an invoice.
        """
        json_payload = super()._l10n_in_edi_generate_invoice_json(invoice)
        if invoice.debit_origin_id:
            json_payload["DocDtls"]["Typ"] = "DBN"
        return json_payload
