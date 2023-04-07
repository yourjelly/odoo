# -*- coding: utf-8 -*-
from hashlib import sha256
from base64 import b64decode, b64encode
from lxml import etree
from odoo import models, fields, _
from odoo.exceptions import UserError
from odoo.modules.module import get_module_resource
from odoo.tools import cleanup_xml_node

TAX_EXEMPTION_CODES = ['VATEX-SA-29', 'VATEX-SA-29-7', 'VATEX-SA-30']
TAX_ZERO_RATE_CODES = ['VATEX-SA-32', 'VATEX-SA-33', 'VATEX-SA-34-1', 'VATEX-SA-34-2', 'VATEX-SA-34-3', 'VATEX-SA-34-4',
                       'VATEX-SA-34-5', 'VATEX-SA-35', 'VATEX-SA-36', 'VATEX-SA-EDU', 'VATEX-SA-HEA']

PAYMENT_MEANS_CODE = {
    'bank': 42,
    'card': 48,
    'cash': 10,
    'transfer': 30,
    'unknown': 1
}


class AccountEdiXmlUBL21Zatca(models.AbstractModel):
    _name = "account.edi.xml.ubl_21.zatca"
    _inherit = 'account.edi.xml.ubl_21'
    _description = "UBL 2.1 (ZATCA)"

    def _l10n_sa_get_namespaces(self):
        return {
            'cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
            'cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
            'ext': 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
            'sig': 'urn:oasis:names:specification:ubl:schema:xsd:CommonSignatureComponents-2',
            'sac': 'urn:oasis:names:specification:ubl:schema:xsd:SignatureAggregateComponents-2',
            'sbc': 'urn:oasis:names:specification:ubl:schema:xsd:SignatureBasicComponents-2',
            'ds': 'http://www.w3.org/2000/09/xmldsig#',
            'xades': 'http://uri.etsi.org/01903/v1.3.2#'
        }

    def _l10n_sa_generate_invoice_xml_sha(self, xml_content):
        """
            Transform, canonicalize then hash the invoice xml content using the SHA256 algorithm,
            then return the hashed content
        :param xml_content:
        :return: sha256 hashing results
        """

        def _canonicalize_xml(content):
            """
                Canonicalize XML content using the c14n method. The specs mention using the c14n11 canonicalization,
                which is simply calling etree.tostring and setting the method argument to 'c14n'. There are minor
                differences between c14n11 and c14n canonicalization algorithms, but for the purpose of ZATCA signing,
                c14n is enough
            :param content: XML content to canonicalize
            :return: Canonicalized XML content
            """
            return etree.tostring(content, method="c14n", exclusive=False, with_comments=False,
                                  inclusive_ns_prefixes=self._l10n_sa_get_namespaces())

        def _transform_and_canonicalize_xml(content):
            """
                Transform XML content to remove certain elements and signatures using an XSL template
            :param content: XML content to transform
            :return: Transformed & Canonicalized XML content
            """
            invoice_xsl = etree.parse(get_module_resource('l10n_sa_edi', 'data', 'pre-hash_invoice.xsl'))
            transform = etree.XSLT(invoice_xsl)
            return _canonicalize_xml(transform(content))

        root = etree.fromstring(xml_content)
        # Transform & canonicalize the XML content
        transformed_xml = _transform_and_canonicalize_xml(root)
        # Get the SHA256 hashed value of the XML content
        return sha256(transformed_xml)

    def _l10n_sa_generate_invoice_xml_hash(self, xml_content, mode='hexdigest'):
        """
            Generate the b64 encoded sha256 hash of a given xml string:
                - First: Transform the xml content using a pre-hash_invoice.xsl file
                - Second: Canonicalize the transformed xml content using the c14n method
                - Third: hash the canonicalized content using the sha256 algorithm then encode it into b64 format
        :param str xml_content: The XML content string to be transformed, canonicalized & hashed
        :param str mode: Name of the function used to return the SHA256 hashing result. Either 'digest' or 'hexdigest'
        :return: XML content hash
        :rtype: bytes
        """
        xml_sha = self._l10n_sa_generate_invoice_xml_sha(xml_content)
        if mode == 'hexdigest':
            xml_hash = xml_sha.hexdigest().encode()
        elif mode == 'digest':
            xml_hash = xml_sha.digest()
        return b64encode(xml_hash)

    def _l10n_sa_generate_invoice_hash(self, invoice, mode='hexdigest'):
        """
            Function that generates the Base 64 encoded SHA256 hash of a given invoice
        :param recordset invoice: Invoice to hash
        :param str mode: Function used to return the SHA256 hashing result. Either 'digest' or 'hexdigest'
        :return: Given Invoice's hash
        :rtype: bytes
        """
        submission_id = invoice._l10n_sa_get_previous_submission()
        if invoice.company_id.l10n_sa_api_mode == 'sandbox' or not submission_id.l10n_sa_xml_content:
            # If no invoice, or if using Sandbox, return the b64 encoded SHA256 value of the '0' character
            return "NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==".encode()
        return self._l10n_sa_generate_invoice_xml_hash(b64decode(submission_id.l10n_sa_xml_content), mode)

    def _get_delivery_vals_list(self, invoice):
        """
            Override to include/update values specific to ZATCA's UBL 2.1 specs
        """
        res = super()._get_delivery_vals_list(invoice)
        if 'partner_shipping_id' in invoice._fields:
            for vals in res:
                vals['actual_delivery_date'] = invoice.l10n_sa_delivery_date
        return res

    def _get_partner_party_identification_vals_list(self, partner):
        """
            Override to include/update values specific to ZATCA's UBL 2.1 specs
        """
        return [{
            'id_attrs': {'schemeID': partner.l10n_sa_additional_identification_scheme},
            'id': partner.l10n_sa_additional_identification_number if partner.l10n_sa_additional_identification_scheme != 'TIN' else partner.vat
        }]

    # def _get_partner_party_vals(self, partner, role):
    #     res = super()._get_partner_party_vals(partner, role)
    #     if role == 'supplier' and self.env.company.l10n_sa_api_mode == 'sandbox':
    #         # x509_certificate = load_der_x509_certificate(b64decode(), default_backend())
    #         res['party_identification_vals']['id'] = '123'
    #     return res

    def _get_invoice_payment_means_vals_list(self, invoice):
        """
            Override to include/update values specific to ZATCA's UBL 2.1 specs
        """
        res = super()._get_invoice_payment_means_vals_list(invoice)
        payment_means = 'unknown'
        # todo: add the test in the pos module
        if invoice._l10n_sa_is_simplified() and getattr(invoice, 'pos_order_ids', None):
            payment_means = invoice.pos_order_ids.payment_ids.payment_method_id.type
        res[0]['payment_means_code'] = PAYMENT_MEANS_CODE[payment_means]
        res[0]['payment_means_code_attrs'] = {'listID': 'UN/ECE 4461'}
        res[0]['adjustment_reason'] = invoice.ref
        return res

    def _get_partner_address_vals(self, partner):
        """
            Override to include/update values specific to ZATCA's UBL 2.1 specs
        """
        return {
            **super()._get_partner_address_vals(partner),
            'building_number': partner.l10n_sa_edi_building_number,
            'neighborhood': partner.street2,
            'plot_identification': partner.l10n_sa_edi_plot_identification,
        }

    def _export_invoice_filename(self, invoice):
        return f"{invoice.name.replace('/', '_')}_ubl_21.xml"

    def _l10n_sa_get_invoice_transaction_code(self, invoice):
        """
            Returns the transaction code string to be inserted in the UBL file follows the following format:
                - NNPNESB, in compliance with KSA Business Rule KSA-2, where:
                    - NN (positions 1 and 2) = invoice subtype:
                        - 01 for tax invoice
                        - 02 for simplified tax invoice
                    - E (position 5) = Exports invoice transaction, 0 for false, 1 for true
        """
        is_exports = invoice.commercial_partner_id.country_id != invoice.company_id.partner_id.commercial_partner_id.country_id
        return '0%s00%s00' % (
            '2' if invoice._l10n_sa_is_simplified() else '1',
            '1' if is_exports and not invoice._l10n_sa_is_simplified() else '0'
        )

    def _l10n_sa_get_invoice_type(self, invoice):
        """
            Returns the invoice type string to be inserted in the UBL file
                - 383: Debit Note
                - 381: Credit Note
                - 388: Invoice
        """
        return 383 if invoice.debit_origin_id else 381 if invoice.move_type == 'out_refund' else 388

    def _l10n_sa_get_billing_reference_vals(self, invoice):
        """
            Get the billing reference vals required to render the BillingReference for credit/debit notes
        """
        if self._l10n_sa_get_invoice_type(invoice) != 388:
            return {
                'id': (
                            invoice.reversed_entry_id.name or invoice.ref) if invoice.move_type == 'out_refund' else invoice.debit_origin_id.name,
                'issue_date': None,
            }
        return {}

    def _get_partner_party_tax_scheme_vals_list(self, partner, role):
        """
            Override to return an empty list if the partner is a customer and their country is not KSA.
            This is according to KSA Business Rule BR-KSA-46 which states that in the case of Export Invoices,
            the buyer VAT registration number or buyer group VAT registration number must not exist in the Invoice
        """
        if role != 'customer' or partner.country_id.code == 'SA':
            return super()._get_partner_party_tax_scheme_vals_list(partner, role)
        return []

    def _apply_invoice_tax_filter(self, tax_values):
        """
            Override to filter out withholding tax
        """
        if tax_values['base_line_id'].move_id._is_downpayment():
            return not tax_values['tax_id'].l10n_sa_is_retention
        return not (tax_values['tax_id'].l10n_sa_is_retention or tax_values['base_line_id'].sale_line_ids.is_downpayment)

    def _l10n_sa_get_prepaid_amount(self, invoice, vals):
        """
            Calculate the down-payment amount according to ZATCA rules
        """
        base_amount = tax_amount = 0
        downpayment_lines = invoice.line_ids.filtered(lambda l: l.sale_line_ids.is_downpayment) if not invoice._is_downpayment() else []
        if downpayment_lines:
            tax_vals = invoice._prepare_edi_tax_details(filter_to_apply=lambda t: not t['tax_id'].l10n_sa_is_retention)
            base_amount = abs(sum(tax_vals['invoice_line_tax_details'][l]['base_amount_currency'] for l in downpayment_lines))
            tax_amount = abs(sum(tax_vals['invoice_line_tax_details'][l]['tax_amount_currency'] for l in downpayment_lines))
        return {
            'total_amount': base_amount + tax_amount,
            'base_amount': base_amount,
            'tax_amount': tax_amount
        }

    def _get_tax_category_list(self, invoice, taxes):
        """ Override to filter out withholding taxes """
        non_retention_taxes = taxes.filtered(lambda t: not t.l10n_sa_is_retention)
        return super()._get_tax_category_list(invoice, non_retention_taxes)

    def _export_invoice_vals(self, invoice):
        """
            Override to include/update values specific to ZATCA's UBL 2.1 specs
        """
        vals = super()._export_invoice_vals(invoice)

        vals.update({
            'main_template': 'account_edi_ubl_cii.ubl_20_Invoice',
            'InvoiceType_template': 'l10n_sa_edi.ubl_21_InvoiceType_zatca',
            'InvoiceLineType_template': 'l10n_sa_edi.ubl_21_InvoiceLineType_zatca',
            'AddressType_template': 'l10n_sa_edi.ubl_21_AddressType_zatca',
            'PartyType_template': 'l10n_sa_edi.ubl_21_PartyType_zatca',
            'TaxTotalType_template': 'l10n_sa_edi.ubl_21_TaxTotalType_zatca',
            'PaymentMeansType_template': 'l10n_sa_edi.ubl_21_PaymentMeansType_zatca',
        })

        vals['vals'].update({
            'profile_id': 'reporting:1.0',
            'invoice_type_code_attrs': {'name': self._l10n_sa_get_invoice_transaction_code(invoice)},
            'invoice_type_code': self._l10n_sa_get_invoice_type(invoice),
            'issue_date': fields.Datetime.context_timestamp(self.with_context(tz='Asia/Riyadh'),
                                                            invoice.l10n_sa_confirmation_datetime),
            'previous_invoice_hash': self._l10n_sa_generate_invoice_hash(invoice).decode(),
            'billing_reference_vals': self._l10n_sa_get_billing_reference_vals(invoice),
            'tax_total_vals': self._l10n_sa_get_additional_tax_total_vals(invoice, vals),
            # Due date is not required for ZATCA UBL 2.1
            'due_date': None,
        })

        # We use base_amount_currency + tax_amount_currency instead of amount_total because we do not want to include
        # withholding tax amounts in our calculations
        total_amount = abs(vals['taxes_vals']['base_amount_currency'] + vals['taxes_vals']['tax_amount_currency'])

        # - When we calculate the tax values, we filter out taxes and invoice lines linked to downpayments.
        #   As such, when we calculate the TaxInclusiveAmount, it already accounts for the tax amount of the downpayment
        #   Same goes for the TaxExclusiveAmount, and we do not need to add the Tax amount of the downpayment
        # - The payable amount does not account for the tax amount of the downpayment, so we add it
        downpayment_vals = self._l10n_sa_get_prepaid_amount(invoice, vals)

        vals['vals']['legal_monetary_total_vals'].update({
            'tax_inclusive_amount': total_amount + downpayment_vals['base_amount'],
            'tax_exclusive_amount': invoice.amount_untaxed + downpayment_vals['base_amount'],
            'prepaid_amount': downpayment_vals['total_amount'],
            'payable_amount': total_amount - downpayment_vals['tax_amount']
        })

        return vals

    def _l10n_sa_get_additional_tax_total_vals(self, invoice, vals):
        """
            For ZATCA, an additional TaxTotal element needs to be included in the UBL file
            (Only for the Invoice, not the lines)

            If the invoice is in a different currency from the one set on the company (SAR), then the additional
            TaxAmount element needs to hold the tax amount converted to the company's currency.

            Business Rules: BT-110 & BT-111
        """
        curr_amount = abs(vals['taxes_vals']['tax_amount_currency'])
        if invoice.currency_id != invoice.company_currency_id:
            curr_amount = abs(vals['taxes_vals']['tax_amount'])
        return vals['vals']['tax_total_vals'] + [{
            'currency': invoice.company_currency_id,
            'currency_dp': invoice.company_currency_id.decimal_places,
            'tax_amount': curr_amount,
        }]

    def _get_invoice_line_item_vals(self, line, taxes_vals):
        """
            Override to include/update values specific to ZATCA's UBL 2.1 specs
        """
        vals = super()._get_invoice_line_item_vals(line, taxes_vals)
        vals['sellers_item_identification_vals'] = {'id': line.product_id.code or line.product_id.default_code}
        return vals

    def _l10n_sa_get_line_prepayment_vals(self, line, taxes_vals):
        if not line.move_id._is_downpayment() and line.sale_line_ids and all(sale_line.is_downpayment for sale_line in line.sale_line_ids):
            prepayment_move_id = line.sale_line_ids.invoice_lines.move_id.filtered(lambda m: m._is_downpayment())
            return {
                'prepayment_id': prepayment_move_id.name,
                'issue_date': fields.Datetime.context_timestamp(self.with_context(tz='Asia/Riyadh'),
                                                                prepayment_move_id.l10n_sa_confirmation_datetime),
                'document_type_code': 386
            }
        return {}

    def _get_invoice_line_vals(self, line, taxes_vals):
        """
            Override to include/update values specific to ZATCA's UBL 2.1 specs
        """
        line_vals = super()._get_invoice_line_vals(line, taxes_vals)
        rounding_amount = abs(taxes_vals['tax_amount_currency'] + taxes_vals['base_amount_currency'])
        extension_amount = abs(line_vals['line_extension_amount'])
        if not line.move_id._is_downpayment() and line.sale_line_ids.filtered(lambda l: l.is_downpayment):
            rounding_amount = extension_amount = 0
            line_vals['price_vals']['price_amount'] = 0
            line_vals['tax_total_vals'][0]['tax_amount'] = 0
            line_vals['prepayment_vals'] = self._l10n_sa_get_line_prepayment_vals(line, taxes_vals)
        line_vals['tax_total_vals'][0]['line_amount_total'] = rounding_amount
        line_vals['invoiced_quantity'] = abs(line_vals['invoiced_quantity'])
        line_vals['line_extension_amount'] = extension_amount
        return line_vals

    def _get_invoice_tax_totals_vals_list(self, invoice, taxes_vals):
        """
            Override to include/update values specific to ZATCA's UBL 2.1 specs.
            In this case, we make sure the tax amounts are always absolute (no negative values)
        """
        res = [{
            'currency': invoice.currency_id,
            'currency_dp': invoice.currency_id.decimal_places,
            'tax_amount': abs(taxes_vals['tax_amount_currency']),
            'tax_subtotal_vals': [{
                'currency': invoice.currency_id,
                'currency_dp': invoice.currency_id.decimal_places,
                'taxable_amount': abs(vals['base_amount_currency']),
                'tax_amount': abs(vals['tax_amount_currency']),
                'percent': vals['_tax_category_vals_']['percent'],
                'tax_category_vals': vals['_tax_category_vals_'],
            } for vals in taxes_vals['tax_details'].values()],
        }]
        return res

    def _export_invoice(self, invoice):
        """
            Override to include/update values specific to ZATCA's UBL 2.1 specs.
            In this case, we need to make sure blank nodes are not removed from the final xml by making
            remove_blank_nodes = False
        """
        vals = self._export_invoice_vals(invoice)
        errors = [constraint for constraint in self._export_invoice_constraints(invoice, vals).values() if constraint]
        xml_content = self.env['ir.qweb']._render(vals['main_template'], vals)
        return etree.tostring(cleanup_xml_node(xml_content, remove_blank_nodes=False)), set(errors)

    def _get_tax_unece_codes(self, invoice, tax):
        """
            Override to include/update values specific to ZATCA's UBL 2.1 specs
        """

        def _exemption_reason(code, reason):
            return {
                'tax_category_code': code,
                'tax_exemption_reason_code': reason,
                'tax_exemption_reason': exemption_codes[reason].split(reason)[1].lstrip(),
            }

        supplier = invoice.company_id.partner_id.commercial_partner_id
        customer = invoice.commercial_partner_id
        if supplier.country_id == customer.country_id and supplier.country_id.code == 'SA':
            if not tax or tax.amount == 0:
                exemption_codes = dict(tax._fields["l10n_sa_exemption_reason_code"]._description_selection(self.env))
                if tax.l10n_sa_exemption_reason_code in TAX_EXEMPTION_CODES:
                    return _exemption_reason('E', tax.l10n_sa_exemption_reason_code)
                elif tax.l10n_sa_exemption_reason_code in TAX_ZERO_RATE_CODES:
                    return _exemption_reason('Z', tax.l10n_sa_exemption_reason_code)
                else:
                    return {
                        'tax_category_code': 'O',
                        'tax_exemption_reason_code': 'Not subject to VAT',
                        'tax_exemption_reason': 'Not subject to VAT',
                    }
            else:
                return {
                    'tax_category_code': 'S',
                    'tax_exemption_reason_code': None,
                    'tax_exemption_reason': None,
                }
        return super()._get_tax_unece_codes(invoice, tax)

    def _get_invoice_payment_terms_vals_list(self, invoice):
        """
            Override to include/update values specific to ZATCA's UBL 2.1 specs
        """
        return []
