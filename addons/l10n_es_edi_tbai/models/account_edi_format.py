# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, _

from .res_company import L10N_ES_EDI_TBAI_VERSION

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
        inv_xml = self._l10n_es_tbai_get_invoice_xml(invoices)

        # Call the web service and get response
        res = self._l10n_es_tbai_call_web_service_sign(invoices, inv_xml)

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

    # -------------------------------------------------------------------------
    # TBAI XML BUILD
    # -------------------------------------------------------------------------

    def _l10n_es_tbai_get_invoice_xml(self, invoice):
        values = self._l10n_es_tbai_get_header_values(invoice)
        values.update(self._l10n_es_tbai_get_subject_values(invoice))
        values.update(self._l10n_es_tbai_get_move_values(invoice))
        values.update(self._l10n_es_tbai_get_trail_values(invoice))
        return self.env.ref('l10n_es_edi_tbai.template_invoice_bundle')._render(values)

    def _l10n_es_tbai_get_header_values(self, invoice):
        return {
            'IDVersionTBAI': L10N_ES_EDI_TBAI_VERSION
        }

    def _l10n_es_tbai_get_subject_values(self, invoice):
        xml_recipients = []

        # === PARTNERS ===
        # TODO multiple partners ?
        for dest in (1,):
            eu_country_codes = set(self.env.ref('base.europe').country_ids.mapped('code'))
            partner = invoice.commercial_partner_id if invoice.is_sale_document() else invoice.company_id

            NIF = False
            IDOtro_Code = False
            IDOtro_ID = partner.vat or 'NO_DISPONIBLE'
            IDOtro_Type = ""
            if (not partner.country_id or partner.country_id.code == 'ES') and partner.vat:
                # ES partner with VAT.
                NIF = partner.vat[2:] if partner.vat.startswith('ES') else partner.vat
            elif partner.country_id.code in eu_country_codes:
                # European partner
                IDOtro_Type = '02'
            else:
                if partner.vat:
                    IDOtro_Type = '04'
                else:
                    IDOtro_Type = '06'
                if partner.country_id:
                    IDOtro_Code = partner.country_id.code

            values_dest = {
                'NIF': NIF,
                'IDOtro_CodigoPais': IDOtro_Code,
                'IDOtro_ID': IDOtro_ID,
                'IDOtro_IDType': IDOtro_Type,
                'ApellidosNombreRazonSocial': partner.name,
                'CodigoPostal': partner.zip,
                'Direccion': ", ".join(filter(lambda x: x, [partner.street, partner.street2, partner.city]))
            }
            xml_recipients.append(self.env.ref('l10n_es_edi_tbai.template_invoice_destinatarios')._render(values_dest))
        # TODO check that less than 100 recipients (max for TBAI) ?

        # === SENDER ===
        sender = invoice.company_id if invoice.is_sale_document() else invoice.commercial_partner_id
        return {
            'Emisor': sender,
            'Destinatarios': xml_recipients,
            'VariosDestinatarios': "N",  # TODO
            'TerceroODestinatario': "D"  # TODO
        }

    def _l10n_es_tbai_get_move_values(self, invoice):
        return {}

    def _l10n_es_tbai_get_trail_values(self, invoice):
        return {}

    # -------------------------------------------------------------------------
    # TBAI SERVER CALLS
    # -------------------------------------------------------------------------

    def _l10n_es_tbai_call_web_service_sign(self, invoice, invoice_values):
        return {invoice: {'success': True}}
