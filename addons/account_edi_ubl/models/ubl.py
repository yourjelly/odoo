from odoo import _
from . import xml_builder


class Ubl20():

    def __init__(self, invoice):
        self.invoice = invoice
        self.builder = self._get_xml_builder(self.invoice)

    def _get_ubl_TaxTotalType(self, invoice, tax_detail_vals_list):
        return xml_builder.Parent('cac:TaxTotal', [
            xml_builder.MonetaryValue(
                'cbc:TaxAmount',
                sum(tax_vals['tax_amount_currency'] for tax_vals in tax_detail_vals_list),
                invoice.currency_id.decimal_places,
                attrs={'currencyID': invoice.currency_id.name},
            ),
            xml_builder.Multi([
                xml_builder.Parent(
                    'cac:TaxSubtotal',
                    [
                        xml_builder.MonetaryValue(
                            'cbc:TaxableAmount',
                            tax_vals['tax_base_amount_currency'],
                            invoice.currency_id.decimal_places,
                            attrs={'currencyID': invoice.currency_id.name},
                        ),
                        xml_builder.MonetaryValue(
                            'cbc:TaxAmount',
                            tax_vals['tax_amount_currency'],
                            invoice.currency_id.decimal_places,
                            attrs={'currencyID': invoice.currency_id.name},
                        ),
                        xml_builder.Value(
                            'cbc:Percent',
                            tax_vals['tax'].amount if tax_vals['tax'].amount_type == 'percent' else None,
                        ),
                    ],
                    internal_data={'tax': tax_vals['tax']},
                )
                for tax_vals in tax_detail_vals_list
            ]),
        ])

    def _get_ubl_InvoiceLineType(self, invoice, invoice_line_vals):
        line = invoice_line_vals['line']

        return xml_builder.Parent('cac:InvoiceLine', [
            xml_builder.Value('cbc:ID', line.id),
            xml_builder.Value('cbc:Note', _("Discount (%s %%)", line.discount) if line.discount else None),
            xml_builder.FieldValue('cbc:InvoicedQuantity', line, ['quantity']),
            xml_builder.MonetaryValue(
                'cbc:LineExtensionAmount',
                line.price_subtotal,
                invoice.currency_id.decimal_places,
                attrs={'currencyID': invoice.currency_id.name},
            ),
            xml_builder.Multi([
                self._get_ubl_TaxTotalType(invoice, invoice_line_vals['tax_detail_vals_list']),
            ]),
            xml_builder.Parent('cac:Item', [
                xml_builder.Value('cbc:Description', (line.name or '').replace('\n', ', ')),
                xml_builder.FieldValue('cbc:Name', line, ['product_id.name']),
                xml_builder.Parent('cac:SellersItemIdentification', [
                    xml_builder.FieldValue('cbc:ID', line, ['product_id.default_code']),
                ]),
            ]),
            xml_builder.Parent('cac:Price', [
                xml_builder.MonetaryValue(
                    'cbc:PriceAmount',
                    line.price_unit,
                    invoice.currency_id.decimal_places,
                    attrs={'currencyID': invoice.currency_id.name},
                ),
            ]),
        ], internal_data={'line': line})

    def _get_ubl_PartyType(self, invoice, partner):
        return xml_builder.Parent(
            'cac:Party',
            [
                xml_builder.FieldValue('cbc:WebsiteURI', partner, ['website']),
                xml_builder.Multi([
                    xml_builder.Parent('cac:PartyName', [
                        xml_builder.FieldValue('cbc:Name', partner, ['name']),
                    ]),
                ]),
                xml_builder.Parent('cac:Language', [
                    xml_builder.FieldValue('cbc:LocaleCode', partner, ['lang']),
                ]),
                xml_builder.Parent('cac:PostalAddress', [
                    xml_builder.FieldValue('cbc:StreetName', partner, ['street']),
                    xml_builder.FieldValue('cbc:AdditionalStreetName', partner, ['street2']),
                    xml_builder.FieldValue('cbc:CityName', partner, ['city']),
                    xml_builder.FieldValue('cbc:PostalZone', partner, ['zip']),
                    xml_builder.FieldValue('cbc:CountrySubentity', partner, ['state_id.name']),
                    xml_builder.FieldValue('cbc:CountrySubentityCode', partner, ['state_id.code']),
                    xml_builder.Parent('cac:Country', [
                        xml_builder.FieldValue('cbc:IdentificationCode', partner, ['country_id.code']),
                        xml_builder.FieldValue('cbc:Name', partner, ['country_id.name']),
                    ])
                ]),
                xml_builder.Multi([
                    xml_builder.Parent('cac:PartyTaxScheme', [
                        xml_builder.FieldValue('cbc:RegistrationName', partner, ['name']),
                        xml_builder.FieldValue('cbc:CompanyID', partner, ['vat']),
                        xml_builder.Parent('cac:TaxScheme', [
                            xml_builder.Value('cbc:ID', 'VAT', attrs={
                                'schemeID': 'UN/ECE 5153',  # TODO we should be able to change this.
                                'schemeAgencyID': '6',
                            }),
                        ]),
                    ]),
                ]),
                xml_builder.Parent('cac:Contact', [
                    xml_builder.FieldValue('cbc:Name', partner, ['name']),
                    xml_builder.FieldValue('cbc:Telephone', partner, ['phone']),
                    xml_builder.FieldValue('cbc:ElectronicMail', partner, ['email']),
                ]),
            ],
            internal_data={'partner': partner},
        )

    def _get_xml_builder(self, invoice):
        invoice_vals = invoice._prepare_edi_vals_to_export()

        return xml_builder.XmlBuilder(
            xml_builder.Parent(
                'Invoice',
                [
                    xml_builder.Value('cbc:UBLVersionID', 2.0),
                    xml_builder.Value('cbc:CustomizationID', None),
                    xml_builder.Value('cbc:ProfileID', None),
                    xml_builder.FieldValue('cbc:ID', invoice, ['name'], required=lambda n: True),
                    xml_builder.FieldValue('cbc:IssueDate', invoice, ['invoice_date'], required=lambda n: True),
                    xml_builder.Value('cbc:InvoiceTypeCode', 380 if invoice.move_type == 'out_invoice' else 381),
                    xml_builder.Multi([
                        xml_builder.FieldValue('cbc:Note', invoice, ['narration']),
                    ]),
                    xml_builder.FieldValue('cbc:DocumentCurrencyCode', invoice, ['currency_id.name'], required=lambda n: True),
                    xml_builder.Value('cbc:TaxCurrencyCode', None),
                    xml_builder.Value('cbc:LineCountNumeric', len(invoice_vals['invoice_line_vals_list'])),
                    xml_builder.Parent('cac:OrderReference', [
                        xml_builder.FieldValue('cbc:ID', invoice, ['invoice_origin']),
                    ]),
                    xml_builder.Parent('cac:AccountingSupplierParty', [
                        self._get_ubl_PartyType(invoice, invoice.company_id.partner_id.commercial_partner_id),
                    ]),
                    xml_builder.Parent('cac:AccountingCustomerParty', [
                        self._get_ubl_PartyType(invoice, invoice.commercial_partner_id),
                    ]),
                    xml_builder.Multi([
                        xml_builder.Parent('cac:PaymentMeans', [
                            xml_builder.Value(
                                'cbc:PaymentMeansCode',
                                42 if invoice.journal_id.bank_account_id else 31,
                                attrs={'listID': 'UN/ECE 4461'},
                            ),
                            xml_builder.FieldValue('cbc:PaymentDueDate', invoice, ['invoice_date_due']),
                            xml_builder.FieldValue('cbc:InstructionID', invoice, ['payment_reference']),
                            xml_builder.Parent('cac:PayeeFinancialAccount', [
                                xml_builder.FieldValue(
                                    'cbc:ID',
                                    invoice,
                                    ['partner_bank_id.acc_number'],
                                    attrs={'schemeName': 'IBAN'},
                                    required=lambda n: n.parent_node.parent_node['cbc:PaymentMeansCode'].value in [30, 58]
                                ),
                                xml_builder.Parent('cac:FinancialInstitutionBranch', [
                                    xml_builder.FieldValue(
                                        'cbc:ID',
                                        invoice,
                                        ['journal_id.bank_account_id.bank_bic'],
                                        attrs={'schemeName': 'BIC'},
                                    ),
                                ]),
                            ]),
                        ]),
                    ]),
                    xml_builder.Multi([
                        xml_builder.Parent('cac:PaymentTerms', [
                            xml_builder.Multi([
                                xml_builder.Parent('cac:Note', [
                                    xml_builder.FieldValue('cbc:Note', invoice, ['invoice_payment_term_id.name']),
                                ]),
                            ]),
                        ]),
                    ]),
                    xml_builder.Multi([
                        self._get_ubl_TaxTotalType(invoice, invoice_vals['tax_detail_vals_list']),
                    ]),
                    xml_builder.Parent('cac:LegalMonetaryTotal', [
                        xml_builder.MonetaryValue(
                            'cbc:LineExtensionAmount',
                            invoice.amount_untaxed,
                            invoice.currency_id.decimal_places,
                            attrs={'currencyID': invoice.currency_id.name},
                        ),
                        xml_builder.MonetaryValue(
                            'cbc:TaxExclusiveAmount',
                            invoice.amount_untaxed,
                            invoice.currency_id.decimal_places,
                            attrs={'currencyID': invoice.currency_id.name},
                        ),
                        xml_builder.MonetaryValue(
                            'cbc:TaxInclusiveAmount',
                            invoice.amount_total,
                            invoice.currency_id.decimal_places,
                            attrs={'currencyID': invoice.currency_id.name},
                        ),
                        xml_builder.MonetaryValue(
                            'cbc:PrepaidAmount',
                            invoice.amount_total - invoice.amount_residual,
                            invoice.currency_id.decimal_places,
                            attrs={'currencyID': invoice.currency_id.name},
                        ),
                        xml_builder.MonetaryValue(
                            'cbc:PayableAmount',
                            invoice.amount_residual,
                            invoice.currency_id.decimal_places,
                            attrs={'currencyID': invoice.currency_id.name},
                        ),
                    ]),
                    xml_builder.Multi([
                        self._get_ubl_InvoiceLineType(invoice, line_vals)
                        for line_vals in invoice_vals['invoice_line_vals_list']
                    ]),
                ],
                internal_data={'invoice': invoice},
            ),
            nsmap={
                None: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
                'cac': "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
                'cbc': "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
            }
        )


class Ubl21(Ubl20):

    def _get_xml_builder(self, invoice):
        builder = super()._get_xml_builder(invoice)
        builder.root_node['cbc:UBLVersionID'].set_value(2.1)
        buyerReference = xml_builder.FieldValue('cbc:BuyerReference', invoice, ['commercial_partner_id.name'])
        builder.root_node.insert_after('cbc:LineCountNumeric', buyerReference)
        return builder
