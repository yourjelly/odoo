from odoo import models


class AccountEdiXmlUBLPE(models.AbstractModel):
    _inherit = "account.edi.xml.ubl_21"
    _name = "account.edi.xml.ubl_pe"
    _description = "PE UBL 2.1"

    # -------------------------------------------------------------------------
    # EXPORT
    # -------------------------------------------------------------------------

    def _export_invoice_filename(self, invoice):
        return f"{invoice.name.replace('/', '_')}_ubl_pe.xml"

    def _get_partner_party_identification_vals_list(self, partner):
        # EXTENDS account.edi.xml.ubl_21
        vals = super()._get_partner_party_identification_vals_list(partner)
        vals.append({
            'id_attrs': {
                'schemeID': (
                    partner.l10n_latam_identification_type_id
                    and partner.l10n_latam_identification_type_id.l10n_pe_vat_code
                ),
            },
            'id': partner.vat,
        })
        return vals

    def _get_partner_address_vals(self, partner):
        vals = super()._get_partner_address_vals(partner)
        vals.update({
            'id': partner.l10n_pe_district and partner.l10n_pe_district.code,
            'address_type_code': partner.company_id and partner.company_id.l10n_pe_edi_address_type_code,
        })
        return vals

    def _get_invoice_payment_means_vals_list(self, invoice):
        spot = invoice._l10n_pe_edi_get_spot()
        if not spot:
            return super()._get_invoice_payment_means_vals_list(invoice)

        vals = {
            'id': spot['id'],
            'payment_means_code': spot['payment_means_code'],
            'payee_financial_account_vals': {
                'id': spot['payee_financial_account'],
            },
        }
        return [vals]

    def _get_invoice_payment_terms_vals_list(self, invoice):
        spot = invoice._l10n_pe_edi_get_spot()
        invoice_date_due_vals_list = []
        first_time = True
        for rec_line in invoice.line_ids.filtered(lambda l: l.account_type == 'asset_receivable'):
            amount = rec_line.amount_currency
            if spot and first_time:
                amount -= spot['spot_amount']
            first_time = False
            invoice_date_due_vals_list.append({'amount': rec_line.move_id.currency_id.round(amount),
                                               'currency_name': rec_line.move_id.currency_id.name,
                                               'date_maturity': rec_line.date_maturity})
        if not spot:
            total_after_spot = abs(invoice.amount_total)
        else:
            total_after_spot = abs(invoice.amount_total) - spot['spot_amount']
        payment_means_id = invoice._l10n_pe_edi_get_payment_means()
        vals = []
        if spot:
            vals.append({
                'id': spot['id'],
                'payment_means_id': spot['payment_means_id'],
                'payment_percent': spot['payment_percent'],
                'amount_attrs': {
                    'currencyID': 'PEN',
                },
                'amount': spot['amount'],
            })
        if invoice.move_type not in ('out_refund', 'in_refund'):
            if payment_means_id == 'Contado':
                vals.append({
                    'id': 'FormaPago',
                    'payment_means_id': payment_means_id,
                })
            else:
                vals.append({
                    'id': 'FormaPago',
                    'payment_means_id': payment_means_id,
                    'amount_attrs': {
                        'currencyID': invoice.currency_id.name,
                    },
                    'amount': self.format_float(total_after_spot, 2),
                })
                for i, due_vals in enumerate(invoice_date_due_vals_list):
                    vals.append({
                        'id': 'FormaPago',
                        'payment_means_id': 'Cuota' + '{0:03d}'.format(i + 1),
                        'amount_attrs': {
                            'currencyID': due_vals['currency_name'],
                        },
                        'amount': self.format_float(due_vals['amount'], 2),
                        'payment_due_date': due_vals['date_maturity'],
                    })

        return vals

    def _get_invoice_tax_totals_vals_list(self, invoice, taxes_vals):
        vals = super()._get_invoice_tax_totals_vals_list(invoice, taxes_vals)

        def grouping_key_generator(base_line, tax_values):
            tax = tax_values['tax_repartition_line'].tax_id
            return {
                'l10n_pe_edi_code': tax.tax_group_id.l10n_pe_edi_code,
                'l10n_pe_edi_international_code': tax.l10n_pe_edi_international_code,
                'l10n_pe_edi_tax_code': tax.l10n_pe_edi_tax_code,
            }

        tax_details_grouped = invoice._prepare_edi_tax_details(grouping_key_generator=grouping_key_generator)
        isc_tax_amount = abs(sum([
            line.amount_currency
            for line in invoice.line_ids.filtered(lambda l: l.tax_line_id.tax_group_id.l10n_pe_edi_code == 'ISC')
        ]))
        vals['tax_subtotal_vals'] = []
        for vals in tax_details_grouped.items():
            vals['tax_subtotal_vals'].append({
                'currency': invoice.currency_id,
                'currency_dp': invoice.currency_id.decimal_places,
                'taxable_amount': (
                    vals['base_amount_currency']
                    - (isc_tax_amount if vals['l10n_pe_edi_code'] != 'ISC' else 0)
                ),
                'tax_amount': vals['tax_amount_currency'] or 0.0,
                'tax_category_vals': {
                    'tax_scheme_vals': {
                        'id': vals['l10n_pe_edi_tax_code'],
                        'name': vals['l10n_pe_edi_code'],
                        'tax_type_code': vals['l10n_pe_edi_international_code'],
                    },
                },
            })

        return vals

    def _export_invoice_vals(self, invoice):
        # EXTENDS account.edi.xml.ubl_21
        vals = super()._export_invoice_vals(invoice)

        supplier = invoice.company_id.partner_id.commercial_partner_id
        customer = invoice.commercial_partner_id

        vals['vals'].update({
            'customization_id': '2.0',
            'id': invoice.name.replace(' ', ''),
            'signature_vals': [{
                'id': 'IDSignKG',
                'signatory_party_vals': {
                    'party_id': invoice.company_id.vat,
                    'party_name': invoice.company_id.name.upper(),
                    'digital_signature_attachment_vals': {
                        'external_reference_uri': '#SignVX',
                    },
                }
            }],
        })

        vals['vals']['accounting_supplier_party_vals'].update({
            'customer_assigned_account_id': supplier.vat,
        })

        vals['vals']['accounting_customer_party_vals'].update({
            'additional_account_id': (
                customer.l10n_latam_identification_type_id
                and customer.l10n_latam_identification_type_id.l10n_pe_vat_code
            ),
        })

        return vals
