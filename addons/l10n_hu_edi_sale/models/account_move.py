# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class AccountMove(models.Model):
    _inherit = "account.move"

    def _l10n_hu_edi_get_invoice_values(self):
        invoice_values = super()._l10n_hu_edi_get_invoice_values()

        for line_values in invoice_values["lines_values"]:
            line = line_values["line"]

            # Situation 1: This is an advance invoice
            if line.is_downpayment:
                line_values["advanceIndicator"] = True

            # Situation 2: This is a final invoice that deducts an advance invoice
            advance_invoice = line._get_downpayment_lines().mapped("move_id").filtered(lambda m: m.state == "posted")
            if advance_invoice:
                advance_invoice = advance_invoice[0]
                currency_rate = self.env["res.currency"]._get_conversion_rate(
                    from_currency=advance_invoice.currency_id,
                    to_currency=self.env.ref("base.HUF"),
                    company=advance_invoice.company_id,
                    date=advance_invoice.invoice_date,
                )
                line_values.update({
                    "advanceIndicator": True,
                    "advanceOriginalInvoice": advance_invoice.name,
                    "advancePaymentDate": advance_invoice.invoice_date,
                    "advanceExchangeRate": currency_rate,
                })
