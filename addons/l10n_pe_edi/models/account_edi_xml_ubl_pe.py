from odoo import models
import pudb


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
                    partner.l10n_latam_identification_type_id.l10n_pe_vat_code
                    if partner.l10n_latam_identification_type_id
                    else None
                ),
            },
            'id': partner.vat,
        })
        return vals

    def _get_partner_address_vals(self, partner):
        # EXTENDS account.edi.xml.ubl_21
        vals = super()._get_partner_address_vals(partner)
        vals.update({
            'id': partner.l10n_pe_district.code if partner.l10n_pe_district else None,
            'address_type_code': partner.company_id.l10n_pe_edi_address_type_code if partner.company_id else None,
        })
        return vals

    def _get_invoice_payment_means_vals_list(self, invoice):
        # EXTENDS account.edi.xml.ubl_21
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
        # EXTENDS account.edi.xml.ubl_21
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
        # EXTENDS account.edi.xml.ubl_21
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
        vals[0]['tax_subtotal_vals'] = []
        for grouping_keys, grouping_vals in tax_details_grouped['tax_details'].items():
            vals[0]['tax_subtotal_vals'].append({
                'currency': invoice.currency_id,
                'currency_dp': invoice.currency_id.decimal_places,
                'taxable_amount': (
                    grouping_vals['base_amount_currency']
                    - (isc_tax_amount if grouping_keys['l10n_pe_edi_code'] != 'ISC' else 0)
                ),
                'tax_amount': grouping_vals['tax_amount_currency'] or 0.0,
                'tax_category_vals': {
                    'tax_scheme_vals': {
                        'id': grouping_keys['l10n_pe_edi_tax_code'],
                        'name': grouping_keys['l10n_pe_edi_code'],
                        'tax_type_code': grouping_keys['l10n_pe_edi_international_code'],
                    },
                },
            })

        return vals

    def _get_invoice_line_tax_totals_vals_list(self, line, taxes_vals):
        # OVERRIDES account.edi.xml.ubl_21
        pass
        vals = {
            'currency': line.currency_id,
            'currency_dp': line.currency_id.decimal_places,
            'tax_amount': line.price_total - line.price_subtotal,
            'tax_subtotal_vals': [{
                'currency': line.currency_id,
                'currency_dp': line.currency_id.decimal_places,
                'taxable_amount': tax_detail_vals['base_amount_currency'] if tax_detail['tax'].tax_group_id.l10n_pe_edi_code != 'ICBPER' else None,
                'tax_amount': tax_detail_vals['tax_amount_currency'] or 0.0,
                'base_unit_measure_attrs': {
                    'unitCode': line.product_uom_id.l10n_pe_edi_measure_unit_code,
                },
                'base_unit_measure': int(line.quantity) if tax_detail['tax'].tax_group_id.l10n_pe_edi_code == 'ICBPER' else None,
                'tax_category_vals': {
                    'percent': tax_detail['tax'].amount if tax_detail['tax'].amount_type == 'percent' else None,
                    'tax_exemption_reason_code': line.l10n_pe_edi_affectation_reason if tax_detail['tax'].tax_group_id.l10n_pe_edi_code not in ('ISC', 'ICBPER') and line.l10n_pe_edi_affectation_reason else None,
                    'tier_range': tax_detail['tax'].l10n_pe_edi_isc_type if tax_detail['tax'].tax_group_id.l10n_pe_edi_code == 'ISC' and tax_detail['tax'].l10n_pe_edi_isc_type else None,
                    'tax_scheme_vals': {
                        'id': tax_detail['tax'].l10n_pe_edi_tax_code,
                        'name': tax_detail['tax'].tax_group_id.l10n_pe_edi_code,
                        'tax_type_code': tax_detail['tax'].l10n_pe_edi_international_code,
                    },
                },
            } for tax_detail, tax_detail_vals in taxes_vals['tax_details'].items()],
        }
        return vals

    def _get_invoice_line_item_vals(self, line, taxes_vals):
        # EXTENDS account.edi.xml.ubl_21
        vals = super()._get_invoice_line_item_vals(line, taxes_vals)
        if vals['description']:
            vals['description'] = vals['description'][:250]
        vals['commodity_classification_vals'] = [{
            'item_classification_code': line.product_id.unspsc_code_id.code if line.product_id else None,
        }]
        return vals

    def _get_invoice_line_vals(self, line, taxes_vals):
        # EXTENDS account.edi.xml.ubl_21
        vals = super()._get_invoice_line_vals(line, taxes_vals)
        line_vals = line._prepare_edi_vals_to_export()
        vals['invoiced_quantity_attrs']['unitCode'] = line.product_uom_id.l10n_pe_edi_measure_unit_code
        vals['pricing_reference_vals'] = {
            'alternative_condition_price_vals': [{
                'price_amount_attrs': {
                    'currencyID': line.currency_id.name,
                },
                'price_amount': line_vals['price_total_unit'],
                'price_amount_dp': self.env['decimal.precision'].precision_get('Product Price'),
                'price_type_code': '01' if not line.currency_id.is_zero(line_vals['price_unit_after_discount']) else '02',
            }]
        }
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

        if vals['order_reference']:
            vals['order_reference'] = vals['order_reference'][:20]

        # Invoice specific changes
        if vals['document_type'] == 'invoice':
            vals['vals'].update({
                'invoice_type_code': invoice.l10n_latam_document_type_id.code,
                'invoice_type_code_attrs': {
                    'listID': invoice.l10n_pe_edi_operation_type,
                    'listAgencyName': 'PE:SUNAT',
                    'listName': 'Tipo de Documento',
                    'listURI': 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo01',
                },
            })
            if invoice.l10n_pe_edi_legend_value:
                vals['vals']['note_vals'].append({
                    'note': invoice.l10n_pe_edi_legend_value,
                    'note_attrs': {'languageLocaleID': invoice.l10n_pe_edi_legend},
                })
            vals['vals']['note_vals'].append({
                'note': invoice._l10n_pe_edi_amount_to_text(),
                'note_attrs': {'languageLocaleID': '1000'},
            })
            if invoice.l10n_pe_edi_operation_type == '1001':
                vals['vals']['note_vals'].append({
                    'note': 'Leyenda: Operacion sujeta a detraccion',
                    'note_attrs': {'languageLocaleID': '2006'},
                })

        # Credit Note specific changes
        if vals['document_type'] == 'credit_note':
            if invoice.l10n_latam_document_type_id.code == '07':
                vals['vals'].update({
                    'discrepancy_response_vals': [{
                        'response_code': invoice.l10n_pe_edi_refund_reason,
                        'description': invoice.ref
                    }]
                })
            if invoice.reversed_entry_id:
                vals['vals'].update({
                    'billing_reference_vals': {
                        'id': invoice.reversed_entry_id.name.replace(' ', ''),
                        'document_type_code': invoice.reversed_entry_id.l10n_latam_document_type_id.code,
                    },
                })

        # Debit Note specific changes
        if vals['document_type'] == 'debit_note':
            if invoice.l10n_latam_document_type_id.code == '08':
                vals['vals'].update({
                    'discrepancy_response_vals': [{
                        'response_code': invoice.l10n_pe_edi_charge_reason,
                        'description': invoice.ref
                    }]
                })
            if invoice.debit_origin_id:
                vals['vals'].update({
                    'billing_reference_vals': {
                        'id': invoice.debit_origin_id.name.replace(' ', ''),
                        'document_type_code': invoice.debit_origin_id.l10n_latam_document_type_id.code,
                    },
                })

        return vals
