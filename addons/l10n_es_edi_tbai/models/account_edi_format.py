# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, _

class AccountEdiFormat(models.Model):
    _inherit = 'account.edi.format'

    # -------------------------------------------------------------------------
    # EDI OVERRIDDEN METHODS
    # -------------------------------------------------------------------------

    def _is_required_for_invoice(self, invoice):
        # OVERRIDE
        if self.code != 'es_tbai':
            return super()._is_required_for_invoice(invoice)

        return invoice.l10n_es_tbai_is_required

    def _needs_web_services(self):
        # OVERRIDE
        return self.code == 'es_tbai' or super()._needs_web_services()

    def _is_compatible_with_journal(self, journal):
        # OVERRIDE
        if self.code != 'es_tbai':
            return super()._is_compatible_with_journal(journal)

        return journal.country_code == 'ES'

    def _post_invoice_edi(self, invoices):
        # OVERRIDE
        if self.code != 'es_tbai':
            return super()._post_invoice_edi(invoices)

        # Ensure a certificate is available.
        certificate = invoices.company_id.l10n_es_tbai_certificate_id
        if not certificate:
            return {inv: {
                'error': _("Please configure the certificate for TicketBai."),
                'blocking_level': 'error',
            } for inv in invoices}

        # Ensure a tax agency is available.
        tax_agency = invoices.company_id.mapped('l10n_es_tbai_tax_agency')[0]
        if not tax_agency:
            return {inv: {
                'error': _("Please specify a tax agency on your company for TicketBai."),
                'blocking_level': 'error',
            } for inv in invoices}

        # Generate the XML values.
        inv_values = self._l10n_es_tbai_get_invoice_values(invoices)

        # Render the XML file
        inv_xml = self.env.ref('l10n_es_edi_tbai.invoice_template')._render(inv_values)

        # Call the web service and get response
        res = self._l10n_es_tbai_call_web_service_sign(invoices, inv_values)

        # Create attachment & post to chatter
        for inv in invoices:  # TODO loop should not be necessary, use ensure_one() ?
            if res.get(inv, {}).get('success'):
                attachment = self.env['ir.attachment'].create({
                    'type': 'binary',
                    'name': inv.name,
                    'raw': inv_xml,
                    'mimetype': 'application/xml',
                    'res_model': inv._name,
                    'res_id': inv.id,
                })
                res[inv]['attachment'] = attachment
                inv.with_context(no_new_invoice=True).message_post(
                    body="TicketBAI mockup document",
                    attachment_ids=attachment.ids)
        return res

    def _l10n_es_tbai_get_invoice_values(self, invoice):
        return {"COMPANY_NIF": 123, "TBAI_VERSION": "1.1", "COMPANY_NAME": "The Best Company"}

    def _l10n_es_tbai_call_web_service_sign(self, invoice, invoice_values):
        return {invoice: {'success': True}}
