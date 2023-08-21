from odoo import models


class AccountEdiXmlUBLPINT(models.AbstractModel):
    _inherit = "account.edi.xml.ubl_bis3"
    _name = 'account.edi.xml.pint'
    _description = "Peppol International (PINT) model for Billing v0.1.2"

    """
    Pint is the new standard for International Billing from Peppol. It is based off bis3.
    This aims to be used as a base for per-country specialization, while keeping a standard core for data being used
    across countries.
    
    It is mostly adding a few new fields compared to bis3.
    
    This is not meant to be used directly, but rather to be extended by country-specific modules.
    
    * Official documentation: https://docs.peppol.eu/poac/pint/pint/
    """

    def _export_invoice_vals(self, invoice):
        # EXTENDS account.edi.xml.ubl_bis3
        vals = super()._export_invoice_vals(invoice)
        # profile_id is here as it is common for PINT. Customization_id is not.
        # customization_id is set in the country-specific module and always follow the format "urn:peppol:pint:billing-1@specialization"
        vals['vals'].update({
            'profile_id': 'urn:peppol:bis:billing',
        })
        return vals

    def _get_partner_address_vals(self, partner):
        # EXTENDS account.edi.xml.ubl_bis3
        vals = super()._get_partner_address_vals(partner)
        # Pint does not use the subentity code and the country name
        vals.pop('country_subentity_code', None)
        return vals
