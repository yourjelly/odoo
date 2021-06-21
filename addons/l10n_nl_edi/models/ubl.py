from odoo import _
from odoo.addons.account_edi_ubl_bis3.models.ubl import Bis3
from odoo.addons.account_edi_ubl.models import xml_builder


class Nlcius(Bis3):

    def _get_ubl_PartyType(self, invoice, partner):
        accounting_party = super()._get_ubl_PartyType(invoice, partner)
        accounting_party.insert_after('cac:PartyTaxScheme',
            xml_builder.Parent('cbc:PartyLegalEntity', [
                xml_builder.FieldValue(
                    'cbc:RegistrationName',
                    partner,
                    ['name']
                ),
                xml_builder.FieldValue(
                    'cbc:CompanyID',
                    partner,
                    ['l10n_nl_oin', 'l10n_nl_kvk'],
                    attrs={'schemeID': '0190' if partner.l10n_nl_oin else '0106'},
                    required=lambda n: n.record.country_code == 'NL'
                ),
            ])
        )

        accounting_party['cac:PostalAddress'].rules.extend([
            (lambda n: n['cac:Country']['cbc:IdentificationCode'].get_value() != 'NL' or \
                       (n['cbc:StreetName'].get_value() and n['cbc:CityName'].get_value() and n['cbc:PostalZone'].get_value()),
            _("Partner's address must include street, zip and city (%s).", partner.display_name)),
        ])

        if partner.country_code == 'NL':
            endpoint_node = accounting_party['cbc:EndpointID']
            endpoint_node.fieldnames = ['l10n_nl_oin', 'l10n_nl_kvk']
            endpoint_node.attrs = {'schemeID': '0190' if partner.l10n_nl_oin else '0106'}

            accounting_party.insert_after('cbc:EndpointID',
            xml_builder.Parent('cac:PartyIdentification', [
                xml_builder.FieldValue('cbc:ID', partner, ['l10n_nl_oin', 'l10n_nl_kvk'])
            ]))

        return accounting_party

    def _get_xml_builder(self, invoice):
        builder = super()._get_xml_builder(invoice)
        builder.root_node['cbc:CustomizationID'].set_value('urn:cen.eu:en16931:2017#compliant#urn:fdc:nen.nl:nlcius:v1.0')
        for payment_means in builder.root_node['cac:PaymentMeans']:
            payment_means['cbc:PaymentMeansCode'].value = 30
        return builder
