# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import api, models, fields, tools, _
from odoo.tools import DEFAULT_SERVER_DATE_FORMAT, float_repr
from odoo.tests.common import Form
from . import xml_builder

from pathlib import PureWindowsPath

import base64
import logging

_logger = logging.getLogger(__name__)


class RequiredValue:
    def __init__(self, value, error):
        self.value = value
        self.error = error

    def is_valid(self):
        return bool(self.value)

    def error_message(self):
        return self.error

    def __str__(self):
        return str(self.value)


class RequiredRecordValue(RequiredValue):
    def __init__(self, record, fieldname):
        super().__init__(
            record[fieldname],
            _(
                "The field '%s' is required on %s.",
                record.fields_get([fieldname])[fieldname]['string'],
                record.display_name,
            ),
        )


class AccountEdiFormat(models.Model):
    _inherit = 'account.edi.format'

    ####################################################
    # Helpers
    ####################################################

    def _is_ubl(self, filename, tree):
        return tree.tag == '{urn:oasis:names:specification:ubl:schema:xsd:Invoice-2}Invoice'

    ####################################################
    # Import
    ####################################################
    def _create_invoice_from_ubl(self, tree):
        invoice = self.env['account.move']
        journal = invoice._get_default_journal()

        move_type = 'out_invoice' if journal.type == 'sale' else 'in_invoice'
        element = tree.find('.//{*}InvoiceTypeCode')
        if element is not None and element.text == '381':
            move_type = 'in_refund' if move_type == 'in_invoice' else 'out_refund'

        invoice = invoice.with_context(default_move_type=move_type, default_journal_id=journal.id)
        return self._import_ubl(tree, invoice)

    def _update_invoice_from_ubl(self, tree, invoice):
        invoice = invoice.with_context(default_move_type=invoice.move_type, default_journal_id=invoice.journal_id.id)
        return self._import_ubl(tree, invoice)

    def _import_ubl(self, tree, invoice):
        """ Decodes an UBL invoice into an invoice.

        :param tree:    the UBL tree to decode.
        :param invoice: the invoice to update or an empty recordset.
        :returns:       the invoice where the UBL data was imported.
        """

        def _get_ubl_namespaces():
            ''' If the namespace is declared with xmlns='...', the namespaces map contains the 'None' key that causes an
            TypeError: empty namespace prefix is not supported in XPath
            Then, we need to remap arbitrarily this key.

            :param tree: An instance of etree.
            :return: The namespaces map without 'None' key.
            '''
            namespaces = tree.nsmap
            namespaces['inv'] = namespaces.pop(None)
            return namespaces

        namespaces = _get_ubl_namespaces()

        def _find_value(xpath, element=tree):
            return self._find_value(xpath, element, namespaces)

        with Form(invoice.with_context(account_predictive_bills_disable_prediction=True)) as invoice_form:
            # Reference
            elements = tree.xpath('//cbc:ID', namespaces=namespaces)
            if elements:
                invoice_form.ref = elements[0].text
            elements = tree.xpath('//cbc:InstructionID', namespaces=namespaces)
            if elements:
                invoice_form.payment_reference = elements[0].text

            # Dates
            elements = tree.xpath('//cbc:IssueDate', namespaces=namespaces)
            if elements:
                invoice_form.invoice_date = elements[0].text
            elements = tree.xpath('//cbc:PaymentDueDate', namespaces=namespaces)
            if elements:
                invoice_form.invoice_date_due = elements[0].text
            # allow both cbc:PaymentDueDate and cbc:DueDate
            elements = tree.xpath('//cbc:DueDate', namespaces=namespaces)
            invoice_form.invoice_date_due = invoice_form.invoice_date_due or elements and elements[0].text

            # Currency
            currency = self._retrieve_currency(_find_value('//cbc:DocumentCurrencyCode'))
            if currency:
                invoice_form.currency_id = currency

            # Incoterm
            elements = tree.xpath('//cbc:TransportExecutionTerms/cac:DeliveryTerms/cbc:ID', namespaces=namespaces)
            if elements:
                invoice_form.invoice_incoterm_id = self.env['account.incoterms'].search([('code', '=', elements[0].text)], limit=1)

            # Partner
            invoice_form.partner_id = self._retrieve_partner(
                name=_find_value('//cac:AccountingSupplierParty/cac:Party//cbc:Name'),
                phone=_find_value('//cac:AccountingSupplierParty/cac:Party//cbc:Telephone'),
                mail=_find_value('//cac:AccountingSupplierParty/cac:Party//cbc:ElectronicMail'),
                vat=_find_value('//cac:AccountingSupplierParty/cac:Party//cbc:CompanyID'),
            )

            # Lines
            lines_elements = tree.xpath('//cac:InvoiceLine', namespaces=namespaces)
            for eline in lines_elements:
                with invoice_form.invoice_line_ids.new() as invoice_line_form:
                    # Product
                    invoice_line_form.product_id = self._retrieve_product(
                        default_code=_find_value('cac:Item/cac:SellersItemIdentification/cbc:ID', eline),
                        name=_find_value('cac:Item/cbc:Name', eline),
                        barcode=_find_value('cac:Item/cac:StandardItemIdentification/cbc:ID[@schemeID=\'0160\']', eline)
                    )

                    # Quantity
                    elements = eline.xpath('cbc:InvoicedQuantity', namespaces=namespaces)
                    quantity = elements and float(elements[0].text) or 1.0
                    invoice_line_form.quantity = quantity

                    # Price Unit
                    elements = eline.xpath('cac:Price/cbc:PriceAmount', namespaces=namespaces)
                    price_unit = elements and float(elements[0].text) or 0.0
                    elements = eline.xpath('cbc:LineExtensionAmount', namespaces=namespaces)
                    line_extension_amount = elements and float(elements[0].text) or 0.0
                    invoice_line_form.price_unit = price_unit or line_extension_amount / invoice_line_form.quantity or 0.0

                    # Name
                    elements = eline.xpath('cac:Item/cbc:Description', namespaces=namespaces)
                    if elements and elements[0].text:
                        invoice_line_form.name = elements[0].text
                        invoice_line_form.name = invoice_line_form.name.replace('%month%', str(fields.Date.to_date(invoice_form.invoice_date).month))  # TODO: full name in locale
                        invoice_line_form.name = invoice_line_form.name.replace('%year%', str(fields.Date.to_date(invoice_form.invoice_date).year))
                    else:
                        partner_name = _find_value('//cac:AccountingSupplierParty/cac:Party//cbc:Name')
                        invoice_line_form.name = "%s (%s)" % (partner_name or '', invoice_form.invoice_date)

                    # Taxes
                    tax_element = eline.xpath('cac:TaxTotal/cac:TaxSubtotal', namespaces=namespaces)
                    invoice_line_form.tax_ids.clear()
                    for eline in tax_element:
                        tax = self._retrieve_tax(
                            amount=_find_value('cbc:Percent', eline),
                            type_tax_use=invoice_form.journal_id.type
                        )
                        if tax:
                            invoice_line_form.tax_ids.add(tax)
        invoice = invoice_form.save()

        # Regenerate PDF
        attachments = self.env['ir.attachment']
        elements = tree.xpath('//cac:AdditionalDocumentReference', namespaces=namespaces)
        for element in elements:
            attachment_name = element.xpath('cbc:ID', namespaces=namespaces)
            attachment_data = element.xpath('cac:Attachment//cbc:EmbeddedDocumentBinaryObject', namespaces=namespaces)
            if attachment_name and attachment_data:
                text = attachment_data[0].text
                # Normalize the name of the file : some e-fff emitters put the full path of the file
                # (Windows or Linux style) and/or the name of the xml instead of the pdf.
                # Get only the filename with a pdf extension.
                name = PureWindowsPath(attachment_name[0].text).stem + '.pdf'
                attachments |= self.env['ir.attachment'].create({
                    'name': name,
                    'res_id': invoice.id,
                    'res_model': 'account.move',
                    'datas': text + '=' * (len(text) % 3),  # Fix incorrect padding
                    'type': 'binary',
                    'mimetype': 'application/pdf',
                })
        if attachments:
            invoice.with_context(no_new_invoice=True).message_post(attachment_ids=attachments.ids)

        return invoice

    ####################################################
    # Export
    ####################################################

    def _get_ubl_2_0_values_partner(self, invoice, partner):
        return {
            'partner': partner,

            'WebsiteURI': partner.website,
            'PartyName_list': [{'Name': partner.name}],
            'Language': {'LocaleCode': partner.lang} if partner.lang else {},
            'PostalAddress': {
                'StreetName': partner.street,
                'AdditionalStreetName': partner.street2,
                'CityName': partner.city,
                'PostalZone': partner.zip,
                'CountrySubentity': partner.state_id.name,
                'CountrySubentityCode': partner.state_id.code,
                'Country': {
                    'IdentificationCode': partner.country_id.code,
                    'Name': partner.country_id.name,
                } if partner.country_id else {},
            },
            'PartyTaxScheme_list': [{
                'RegistrationName': partner.name,
                'CompanyID': partner.vat,
            }] if partner.vat else [],
            'Contact': {
                'Name': partner.name,
                'Telephone': partner.phone,
                'ElectronicMail': partner.email,
            },
        }

    def _get_ubl_2_0_values_tax(self, invoice, tax_detail_vals_list):
        return [{
            'TaxAmount': sum(tax_vals['tax_amount_currency'] for tax_vals in tax_detail_vals_list),
            'TaxSubtotal_list': [{
                'tax': tax_vals['tax'],

                'TaxableAmount': tax_vals['tax_base_amount_currency'],
                'TaxAmount': tax_vals['tax_amount_currency'],
                'Percent': tax_vals['tax'].amount if tax_vals['tax'].amount_type == 'percent' else None,
            } for tax_vals in tax_detail_vals_list],
        }]

    def _get_ubl_2_0_values_invoice_line(self, invoice, invoice_line_vals):
        line = invoice_line_vals['line']

        return {
            '___line___': line,

            'ID': line.id,
            'Note': _("Discount (%s %%)", line.discount) if line.discount else None,
            'InvoicedQuantity': line.quantity,
            'LineExtensionAmount': line.price_subtotal,
            'TaxTotal_list': self._get_ubl_2_0_values_tax(invoice, invoice_line_vals['tax_detail_vals_list']),
            'Item': {
                'Description': line.name.replace('\n', ', ') if line.name else None,
                'Name': line.product_id.name,
                'SellersItemIdentification': {
                    'ID': line.product_id.default_code,
                } if line.product_id.default_code else {},
            },
            'Price': {
                'PriceAmount': line.price_unit,
            },
        }

    def _get_ubl_2_0_values(self, invoice):
        ''' Get the necessary values to generate the XML. These values will be used in the qweb template when
        rendering. Needed values differ depending on the implementation of the UBL, as (sub)template can be overriden
        or called dynamically.
        :returns:   a dictionary with the value used in the template has key and the value as value.
        '''
        def format_monetary(amount):
            # Format the monetary values to avoid trailing decimals (e.g. 90.85000000000001).
            return float_repr(amount, invoice.currency_id.decimal_places)

        invoice_vals = invoice._prepare_edi_vals_to_export()

        return {
            **invoice_vals,

            'check_partner_id': RequiredRecordValue(invoice, 'partner_id'),

            'UBLVersionID': 2.0,
            'CustomizationID': None,
            'ProfileID': None,
            'ID': RequiredRecordValue(invoice, 'name'),
            'IssueDate': RequiredRecordValue(invoice, 'invoice_date'),
            'InvoiceTypeCode': 380 if invoice.move_type == 'out_invoice' else 381,
            'Note_list': [invoice.narration] if invoice.narration else [],
            'DocumentCurrencyCode': invoice.currency_id.name,
            'TaxCurrencyCode': None,
            'LineCountNumeric': len(invoice_vals['invoice_line_vals_list']),
            'OrderReference': {'ID': invoice.invoice_origin} if invoice.invoice_origin else {},
            'AccountingSupplierParty': self._get_ubl_2_0_values_partner(invoice, invoice.company_id.partner_id.commercial_partner_id),
            'AccountingCustomerParty': self._get_ubl_2_0_values_partner(invoice, invoice.commercial_partner_id),
            'PaymentMeans_list': [{
                'PaymentMeansCode': 42 if invoice.journal_id.bank_account_id else 31,
                'PaymentDueDate': invoice.invoice_date_due,
                'PayeeFinancialAccount': {
                    'ID': invoice.journal_id.bank_account_id.acc_number,
                    'FinancialInstitutionBranch': {
                        'ID': invoice.journal_id.bank_account_id.bank_bic,
                    } if invoice.journal_id.bank_account_id.bank_bic else {},
                } if invoice.journal_id.bank_account_id else {},
            }],
            'PaymentTerms_list': [{
                'Note_list': [{'Note': invoice.invoice_payment_term_id.name}],
            }] if invoice.invoice_payment_term_id else [],
            'TaxTotal_list': self._get_ubl_2_0_values_tax(invoice, invoice_vals['tax_detail_vals_list']),
            'LegalMonetaryTotal': {
                'LineExtensionAmount': invoice.amount_untaxed,
                'TaxExclusiveAmount': invoice.amount_untaxed,
                'TaxInclusiveAmount': invoice.amount_total,
                'PrepaidAmount': invoice.amount_total - invoice.amount_residual,
                'PayableAmount': invoice.amount_residual,
            },
            'InvoiceLine_list': [self._get_ubl_2_0_values_invoice_line(invoice, line_vals)
                                 for line_vals in invoice_vals['invoice_line_vals_list']],

            'template_partner': 'account_edi_ubl.export_invoice_ubl_2_0_partner',
            'template_taxes': 'account_edi_ubl.export_invoice_ubl_2_0_taxes',

            'format_monetary': format_monetary,
        }

    @api.model
    def _get_ubl_PartyType(self, invoice, partner):
        return xml_builder.Parent(
            'cac:Party',
            [
                xml_builder.Value('cbc:WebsiteURI', partner.website),
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
                    ]),
                ]),
                xml_builder.Multi([
                    xml_builder.Parent('cac:PartyTaxScheme', [
                        xml_builder.FieldValue('cbc:RegistrationName', partner, ['name']),
                        xml_builder.FieldValue('cbc:CompanyID', partner, ['vat']),
                        xml_builder.Parent('cac:TaxScheme', [
                            xml_builder.Value('cbc:ID', 'VAT', attrs={
                                'schemeID': 'UN/ECE 5153',
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
                xml_builder.Parent('cac:Price', [
                    xml_builder.MonetaryValue(
                        'cbc:PriceAmount',
                        line.price_unit,
                        invoice.currency_id.decimal_places,
                        attrs={'currencyID': invoice.currency_id.name},
                    ),
                ]),
            ]),
        ], internal_data={'line': line})

    @api.model
    def _get_ubl_2_0_builder(self, invoice):
        invoice_vals = invoice._prepare_edi_vals_to_export()

        return xml_builder.XmlBuilder(
            xml_builder.Parent(
                'Invoice',
                [
                    xml_builder.Value('cbc:UBLVersionID', 2.0),
                    xml_builder.Value('cbc:CustomizationID', None),
                    xml_builder.Value('cbc:ProfileID', None),
                    xml_builder.FieldValue('cbc:ID', invoice, ['name'], required=True),
                    xml_builder.FieldValue('cbc:IssueDate', invoice, ['invoice_date'], required=True),
                    xml_builder.Value('cbc:InvoiceTypeCode', 380 if invoice.move_type == 'out_invoice' else 381),
                    xml_builder.Multi([
                        xml_builder.Value('cbc:Note', invoice.narration),
                    ]),
                    xml_builder.FieldValue('cbc:DocumentCurrencyCode', invoice, ['currency_id.name'], required=True),
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
                            xml_builder.Parent('cac:PayeeFinancialAccount', [
                                xml_builder.FieldValue(
                                    'cbc:ID',
                                    invoice,
                                    ['journal_id.bank_account_id.acc_number'],
                                    attrs={'schemeName': 'IBAN'},
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
                nsmap={
                    None: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
                    'cac': "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
                    'cbc': "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
                },
            ),
        )

    @api.model
    def _get_ubl_2_1_builder(self, invoice):
        builder = self._get_ubl_2_0_builder(invoice)
        builder.find_element('Invoice/cbc:UBLVersionID').set_value(2.1)
        return builder

    def _get_ubl_values(self, invoice):
        ''' Get the necessary values to generate the XML. These values will be used in the qweb template when
        rendering. Needed values differ depending on the implementation of the UBL, as (sub)template can be overriden
        or called dynamically.
        :returns:   a dictionary with the value used in the template has key and the value as value.
        '''
        return {
            **self._get_ubl_2_0_values(invoice),
            'UBLVersionID': 2.1,
            'BuyerReference': invoice.commercial_partner_id.name,
        }

    def _export_ubl(self, invoice):
        self.ensure_one()
        # Create file content.
        xml_content = b"<?xml version='1.0' encoding='UTF-8'?>"
        xml_content += self.env.ref('account_edi_ubl.export_invoice_ubl_2_1')._render(self._get_ubl_values(invoice))
        xml_name = '%s_ubl_2_1.xml' % (invoice.name.replace('/', '_'))
        return self.env['ir.attachment'].create({
            'name': xml_name,
            'datas': base64.encodebytes(xml_content),
            'res_model': 'account.move',
            'res_id': invoice.id,
            'mimetype': 'application/xml'
        })

    ####################################################
    # Account.edi.format override
    ####################################################

    def _create_invoice_from_xml_tree(self, filename, tree):
        # OVERRIDE
        self.ensure_one()
        if self.code == 'ubl_2_1' and self._is_ubl(filename, tree):
            return self._create_invoice_from_ubl(tree)
        return super()._create_invoice_from_xml_tree(filename, tree)

    def _update_invoice_from_xml_tree(self, filename, tree, invoice):
        # OVERRIDE
        self.ensure_one()
        if self.code == 'ubl_2_1' and self._is_ubl(filename, tree):
            return self._update_invoice_from_ubl(tree, invoice)
        return super()._update_invoice_from_xml_tree(filename, tree, invoice)

    def _is_compatible_with_journal(self, journal):
        # OVERRIDE
        self.ensure_one()
        if self.code != 'ubl_2_1':
            return super()._is_compatible_with_journal(journal)
        return journal.type == 'sale'

    def _is_enabled_by_default_on_journal(self, journal):
        # OVERRIDE
        # UBL is disabled by default to prevent conflict with other implementations of UBL.
        self.ensure_one()
        if self.code != 'ubl_2_1':
            return super()._is_enabled_by_default_on_journal(journal)
        return False

    def _post_invoice_edi(self, invoices):
        # OVERRIDE
        self.ensure_one()
        if self.code != 'ubl_2_1':
            return super()._post_invoice_edi(invoices)
        res = {}
        for invoice in invoices:
            attachment = self._export_ubl(invoice)
            res[invoice] = {'attachment': attachment}
        return res

    def _is_embedding_to_invoice_pdf_needed(self):
        # OVERRIDE
        self.ensure_one()
        if self.code != 'ubl_2_1':
            return super()._is_embedding_to_invoice_pdf_needed()
        return False  # ubl must not be embedded to PDF.
