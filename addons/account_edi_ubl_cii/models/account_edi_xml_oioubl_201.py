# -*- coding: utf-8 -*-
from odoo import models, tools
from odoo.tools import float_is_zero

DANISH_NATIONAL_IT_AND_TELECOM_AGENCY_ID = '320'

PAYMENT_MEANS_CODE = {
    # https://www.oioubl.info/codelists/en/urn_oioubl_codelist_paymentmeanscode-1.1.html
    'unknown': 1,
    'cash': 10,
    'cheque': 20,
    'debit': 31,
    'bank': 42,
    'card': 48,  # credit card
    'direct debit': 49,
    'compensation': 97,
}
UBL_TO_OIOUBL_TAX_CATEGORY_ID_MAPPING = {
    # Simple mapping between tax type provided in UBL and what is accepted in OIOUBL
    # https://docs.peppol.eu/poacc/billing/3.0/codelist/UNCL5305/
    # https://www.oioubl.info/codelists/en/urn_oioubl_id_taxcategoryid-1.1.html
    'AE': 'ReverseCharge',
    'E': 'ZeroRated',
    'S': 'StandardRated',
    'Z': 'ZeroRated',
    'G': 'ZeroRated',
    'O': 'ZeroRated',
    'K': 'ReverseCharge',
    'L': 'ZeroRated',
    'M': 'ZeroRated',
}
TAX_POSSIBLE_VALUES = set(UBL_TO_OIOUBL_TAX_CATEGORY_ID_MAPPING.values())
ENDPOINTID_SCHEMEID = {
    'DK': 'DK:CVR',
    'AD': 'AD:VAT',
    'AL': 'AL:VAT',
    'AT': 'AT:VAT',
    'BA': 'BA:VAT',
    'BE': 'BE:VAT',
    'BG': 'BG:VAT',
    'CH': 'CH:VAT',
    'CY': 'CY:VAT',
    'CZ': 'CZ:VAT',
    'DE': 'DE:VAT',
    'EE': 'EE:VAT',
    'ES': 'ES:VAT',
    'EU': 'EU:VAT',
    'FI': 'FI:VAT',
    'FR': 'FR:SIRET',
    'GB': 'GB:VAT',
    'GR': 'GR:VAT',
    'HR': 'HR:VAT',
    'HU': 'HU:VAT',
    'IE': 'IE:VAT',
    'IT': 'IT:VAT',
    'LI': 'LI:VAT',
    'LT': 'LT:VAT',
    'LU': 'LU:VAT',
    'LV': 'LV:VAT',
    'MC': 'MC:VAT',
    'ME': 'ME:VAT',
    'MK': 'MK:VAT',
    'MT': 'MT:VAT',
    'NL': 'NL:VAT',
    'NO': 'NO:VAT',
    'PL': 'PL:VAT',
    'PT': 'PT:VAT',
    'RO': 'RO:VAT',
    'RS': 'RS:VAT',
    'SE': 'SE:VAT',
    'SI': 'SI:VAT',
    'SK': 'SK:VAT',
    'SM': 'SM:VAT',
    'TR': 'TR:VAT',
    'VA': 'VA:VAT',
}


class AccountEdiXmlOIOUBL201(models.AbstractModel):
    _name = "account.edi.xml.oioubl_201"
    _inherit = 'account.edi.xml.ubl_20'
    _description = "OIOUBL 2.01"

    # -------------------------------------------------------------------------
    # EXPORT
    # -------------------------------------------------------------------------

    def _export_invoice_filename(self, invoice):
        return f"{invoice.name.replace('/', '_')}_oioubl_201.xml"

    def _export_invoice_ecosio_schematrons(self):
        return {
            'invoice': 'org.oasis-open:invoice:2.0',
            'credit_note': 'org.oasis-open:creditnote:2.0',
        }

    def _export_invoice_vals(self, invoice):
        # EXTENDS account.edi.xml.ubl_20
        vals = super()._export_invoice_vals(invoice)
        vals['vals'].update({
            'customization_id': 'OIOUBL-2.01',
            # ProfileID is the property that define which documents the company can send and receive
            # 'Procurement-BilSim-1.0' is the simplest one: invoice and bill
            # https://www.oioubl.info/documents/en/en/Guidelines/OIOUBL_GUIDE_PROFILES.pdf
            'profile_id': 'Procurement-BilSim-1.0',
            'profile_id_attrs': {
                'schemeID': 'urn:oioubl:id:profileid-1.6',
                'schemeAgencyID': DANISH_NATIONAL_IT_AND_TELECOM_AGENCY_ID,
            }
        })
        vals['vals'].setdefault('invoice_type_code_attrs', {}).update({
            'listID': 'urn:oioubl:codelist:invoicetypecode-1.2',
            'listAgencyID': DANISH_NATIONAL_IT_AND_TELECOM_AGENCY_ID,
        })

        return vals

    def _get_partner_party_vals(self, partner, role):
        vals = super()._get_partner_party_vals(partner, role)
        vals.update({
            # list of possible endpointID available at
            # https://www.oioubl.info/documents/en/en/Guidelines/OIOUBL_GUIDE_ENDPOINT.pdf
            'endpoint_id': partner.vat,
            'endpoint_id_attrs': {'schemeID': ENDPOINTID_SCHEMEID.get(partner.country_code, 'DK:CVR')},
        })
        for party_tax_scheme in vals['party_tax_scheme_vals']:
            # the doc says it could be empty but the schematron says otherwise
            # https://www.oioubl.info/Classes/en/TaxScheme.html
            party_tax_scheme.update({
                'tax_scheme_id': 'VAT',
                'tax_scheme_attrs': {'schemeID': 'urn:oioubl:id:taxschemeid-1.5'},
                'tax_name': 'VAT',
            })
        return vals

    def _get_partner_address_vals(self, partner):
        vals = super()._get_partner_address_vals(partner)
        # 'StructuredDK' for partner in DK
        # could be 'UN/CEFACT codeliste 3477' for partner out of DK
        # https://www.oioubl.info/Classes/en/Address.html
        address = tools.street_split(partner.street)
        street_name = address.get('street_name')
        # TODO BIB: decide what to do when there isn't any building number available
        # possibility: raise UserError asking for completion / switch to an unformated address format
        building_number = address.get('street_number')
        vals.update({
            'address_format_code': 'StructuredDK',
            'address_format_code_attrs': {
                'listAgencyID': DANISH_NATIONAL_IT_AND_TELECOM_AGENCY_ID,
                'listID': 'urn:oioubl:codelist:addressformatcode-1.1',
            },
            'street_name': street_name,
            'building_number': building_number,
        })
        return vals

    def _get_partner_party_tax_scheme_vals_list(self, partner, role):
        vals_list = super()._get_partner_party_tax_scheme_vals_list(partner, role)
        for vals in vals_list:
            if partner.vat:
                # SE is the danish vat number
                # DK:SE indicates we're using it and 'ZZZ' is for international number
                # https://www.oioubl.info/Codelists/en/urn_oioubl_scheme_partytaxschemecompanyid-1.1.html
                vals.update({
                    'company_id_attrs': {'schemeID': 'DK:SE' if partner.country_code == 'DK' else 'ZZZ'},
                    'company_id': partner.vat.replace(" ", ""),
                })

        return vals_list

    def _get_partner_party_legal_entity_vals_list(self, partner):
        vals_list = super()._get_partner_party_legal_entity_vals_list(partner)
        for vals in vals_list:
            vals.update({
                'company_id': partner.vat.replace(" ", ""),
                'company_id_attrs': {'schemeID': 'DK:CVR' if partner.country_code == 'DK' else 'ZZZ'},
            })
        return vals_list

    def _get_invoice_payment_means_vals_list(self, invoice):
        vals_list = super()._get_invoice_payment_means_vals_list(invoice)
        for vals in vals_list:
            # Hardcoded 'unknown' for now
            # Later on, it would be nice to create a dynamically selected template that would depends on the payment means
            vals['payment_means_code'] = PAYMENT_MEANS_CODE['unknown']

        return vals_list

    def _get_invoice_tax_totals_vals_list(self, invoice, taxes_vals):
        vals_list = super()._get_invoice_tax_totals_vals_list(invoice, taxes_vals)
        for tax_total_vals in vals_list:
            for subtotal_vals in tax_total_vals.get('tax_subtotal_vals', []):
                # https://www.oioubl.info/Classes/en/TaxSubtotal.html
                # No 'percent' node in OIOUBL
                subtotal_vals.pop('percent', None)

                # TaxCategory https://www.oioubl.info/Classes/en/TaxCategory.html
                subtotal_vals['tax_category_vals']['id_attrs'] = {
                    'schemeID': 'urn:oioubl:id:taxcategoryid-1.3',
                    'schemeAgencyID': DANISH_NATIONAL_IT_AND_TELECOM_AGENCY_ID,
                }

                # TaxCategory id list: https://www.oioubl.info/codelists/en/urn_oioubl_id_taxcategoryid-1.1.html
                # This if is necessary because we're coming here several time which would make the result being None
                if subtotal_vals['tax_category_vals']['id'] not in TAX_POSSIBLE_VALUES:
                    subtotal_vals['tax_category_vals']['id'] = UBL_TO_OIOUBL_TAX_CATEGORY_ID_MAPPING.get(subtotal_vals['tax_category_vals']['id'])

                subtotal_vals['tax_category_vals']['tax_scheme_name'] = 'VAT'
                subtotal_vals['tax_category_vals']['tax_scheme_id_attrs'] = {'schemeID': 'urn:oioubl:id:taxschemeid-1.5'}

        return vals_list

    def _get_legal_monetary_total_vals(self, invoice, taxes_vals, line_extension_amount, allowance_total_amount):
        vals = super()._get_legal_monetary_total_vals(invoice, taxes_vals, line_extension_amount, allowance_total_amount)
        # In OIOUBL context, tax_exclusive_amount means "tax only"
        vals['tax_exclusive_amount'] = taxes_vals['tax_amount_currency']
        if invoice.currency_id.compare_amounts(vals['prepaid_amount'], 0) <= 0:
            del vals['prepaid_amount']
        return vals

    def _get_invoice_payment_terms_vals_list(self, invoice):
        # TODO BIB: implement cac:PaymentTerms
        # cleaned atm because it's not mandatory
        # https://www.oioubl.info/Classes/en/PaymentTerms.html
        return []

    def _get_tax_category_list(self, invoice, taxes):
        # EXTENDS account.edi.xml.ubl_21
        vals_list = super()._get_tax_category_list(invoice, taxes)
        for vals in vals_list:
            # TaxCategory https://www.oioubl.info/Classes/en/TaxCategory.html
            vals['id'] = UBL_TO_OIOUBL_TAX_CATEGORY_ID_MAPPING.get(vals['id'])
            vals['id_attrs'] = {
                'schemeID': 'urn:oioubl:id:taxcategoryid-1.3',
                'schemeAgencyID': DANISH_NATIONAL_IT_AND_TELECOM_AGENCY_ID,
            }
            vals['tax_scheme_id_attrs'] = {'schemeID': 'urn:oioubl:id:taxschemeid-1.5'}
            vals['tax_scheme_name'] = 'VAT'

        return vals_list

    def _additional_document_reference_get_custom_nodes(self):
        return """<cbc:DocumentTypeCode listAgencyID="6" listID="UN/ECE 1001">380</cbc:DocumentTypeCode>"""
