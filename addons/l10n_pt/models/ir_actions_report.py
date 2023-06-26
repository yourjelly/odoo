# -*- coding: utf-8 -*-
from odoo import models, _
from odoo.tools import pdf


class IrActionsReport(models.Model):
    _inherit = 'ir.actions.report'

    def _l10n_pt_add_banner_invalid(self, collected_streams, records):
        for record in records:
            if (
                record.company_id.account_fiscal_country_id.code == 'PT'
                and record.is_sale_document(include_receipts=True)
                and not record.inalterable_hash
            ):
                pdf_stream = collected_streams[record.id]['stream']
                new_stream = pdf.add_banner(pdf_stream, _("This document is not valid."), logo=False, thickness=80)
                collected_streams[record.id]['stream'] = new_stream
        return collected_streams

    def _render_qweb_pdf_prepare_streams(self, report_ref, data, res_ids=None):
        collected_streams = super()._render_qweb_pdf_prepare_streams(report_ref, data, res_ids=res_ids)
        if report_ref not in (
            'account.report_invoice_with_payments',
            'account.report_invoice',
        ):
            return collected_streams
        invoices = self.env['account.move'].browse(res_ids)
        return self._l10n_pt_add_banner_invalid(collected_streams, invoices)
