from odoo.addons.account_edi_ubl.models.ubl import Ubl21
from odoo.addons.account_edi_ubl.models import xml_builder


COUNTRY_EAS = {
    'HU': 9910,

    'AD': 9922,
    'AL': 9923,
    'BA': 9924,
    'BE': 9925,
    'BG': 9926,
    'CH': 9927,
    'CY': 9928,
    'CZ': 9929,
    'DE': 9930,
    'EE': 9931,
    'UK': 9932,
    'GR': 9933,
    'HR': 9934,
    'IE': 9935,
    'LI': 9936,
    'LT': 9937,
    'LU': 9938,
    'LV': 9939,
    'MC': 9940,
    'ME': 9941,
    'MK': 9942,
    'MT': 9943,
    'NL': 9944,
    'PL': 9945,
    'PT': 9946,
    'RO': 9947,
    'RS': 9948,
    'SI': 9949,
    'SK': 9950,
    'SM': 9951,
    'TR': 9952,
    'VA': 9953,

    'SE': 9955,

    'FR': 9957
}


class Bis3(Ubl21):

    def _get_ubl_PartyType(self, invoice, partner):
        party = super()._get_ubl_PartyType(invoice, partner)
        # TODO this is in ubl as well, maybe we should put it in ubl directly and correct the tests (ubl)
        party.insert_before('cac:PartyName',
            xml_builder.FieldValue('cbc:EndpointID', partner, ['vat'], attrs={'schemeID': str(COUNTRY_EAS[partner.country_id.code])}))

        # TODO This is bis3 only
        party.remove('cac:Language')
        for tax_scheme in party['cac:PartyTaxScheme']:
            del tax_scheme['cbc:RegistrationName']
            tax_scheme['cac:TaxScheme']['cbc:ID'].attrs = {}  # UBL-DT-27
        return party

    def _get_xml_builder(self, invoice):
        builder = super()._get_xml_builder(invoice)
        builder.root_node['cbc:CustomizationID'].set_value('urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0')
        builder.root_node['cbc:ProfileID'].set_value('urn:fdc:peppol.eu:2017:poacc:billing:01:1.0')
        builder.root_node.remove('cbc:UBLVersionID')
        builder.root_node.remove('cbc:LineCountNumeric')

        for payment_means in builder.root_node['cac:PaymentMeans']:
            payment_means.remove('cbc:InstructionID')
            payment_means.remove('cbc:PaymentDueDate')
            payment_means['cac:PayeeFinancialAccount']['cbc:ID'].attrs = {}
            payment_means['cbc:PaymentMeansCode'].attrs = {}

        builder.root_node.insert_after('cbc:IssueDate',
            xml_builder.FieldValue('cbc:DueDate', invoice, ['invoice_date_due'], value_format=lambda date: date.strftime('%Y-%m-%d')))
        for node in builder.root_node.get_all_items('cac:Country', recursive=True):
            node.remove('cbc:Name')
        return builder
