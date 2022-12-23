import re
from odoo import models, fields
from odoo.exceptions import UserError
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec


class ResCompany(models.Model):
    _inherit = "res.company"

    l10n_sa_organization_unit = fields.Char("Organization Unit", compute="_l10n_sa_compute_organization_unit",
                                            help="The branch name for taxpayers. In case of VAT Groups, this field "
                                                 "should contain the 10-digit TIN number of the individual group "
                                                 "member whose device is being onboarded (First 10 digits of the "
                                                 "VAT Number)")

    def _l10n_sa_compute_organization_unit(self):
        for company in self:
            company.l10n_sa_organization_unit = (company.vat or '')[:10]

    def _l10n_sa_compute_private_key(self):
        """
            Compute a private key for each company that will be used to generate certificate signing requests (CSR)
            in order to receive X509 certificates from the ZATCA APIs and sign EDI documents

            -   public_exponent=65537 is a default value that should be used most of the time, as per the documentation
                of cryptography.
            -   key_size=2048 is considered a reasonable default key size, as per the documentation of cryptography.

            See https://cryptography.io/en/latest/hazmat/primitives/asymmetric/rsa/
        """
        private_key = ec.generate_private_key(ec.SECP256K1, default_backend())
        return private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption()
        )

    l10n_sa_private_key = fields.Binary("ZATCA Private key", attachment=False, groups="base.group_erp_manager",
                                        copy=False,
                                        help="The private key used to generate the CSR and obtain certificates",
                                        default=_l10n_sa_compute_private_key)

    l10n_sa_api_mode = fields.Selection(
        [('sandbox', 'Sandbox'), ('preprod', 'Simulation (Pre-Production)'), ('prod', 'Production')],
        help="Specifies which API the system should use", required=True,
        default='sandbox', copy=False)

    l10n_sa_edi_building_number = fields.Char(compute='_compute_address',
                                              inverse='_l10n_sa_edi_inverse_building_number')
    l10n_sa_edi_plot_identification = fields.Char(compute='_compute_address',
                                                  inverse='_l10n_sa_edi_inverse_plot_identification')

    l10n_sa_additional_identification_scheme = fields.Selection(
        related='partner_id.l10n_sa_additional_identification_scheme', readonly=False)
    l10n_sa_additional_identification_number = fields.Char(
        related='partner_id.l10n_sa_additional_identification_number', readonly=False)

    def write(self, vals):
        for company in self:
            if company.l10n_sa_api_mode == 'prod' and 'l10n_sa_api_mode' in vals and vals['l10n_sa_api_mode'] != 'prod':
                raise UserError("You cannot change the ZATCA Submission Mode once it has been set to Production")
        return super().write(vals)

    def _get_company_address_field_names(self):
        """ Override to add ZATCA specific address fields """
        return super()._get_company_address_field_names() + \
            ['l10n_sa_edi_building_number', 'l10n_sa_edi_plot_identification']

    def _l10n_sa_edi_inverse_building_number(self):
        for company in self:
            company.partner_id.l10n_sa_edi_building_number = company.l10n_sa_edi_building_number

    def _l10n_sa_edi_inverse_plot_identification(self):
        for company in self:
            company.partner_id.l10n_sa_edi_plot_identification = company.l10n_sa_edi_plot_identification

    def _l10n_sa_get_csr_invoice_type(self):
        """
            Return the Invoice Type flag used in the CSR. 4-digit numerical input using 0 & 1 mapped to “TSCZ” where:
            -   0: False/Not supported, 1: True/Supported
            -   T: Tax Invoice (Standard), S: Simplified Invoice, C & Z will be used in the future and should
                always be 0
            For example: 1100 would mean the Solution will be generating Standard and Simplified invoices.
            We can assume Odoo-powered EGS solutions will always generate both Standard & Simplified invoices
        :return:
        """
        return '1100'

    def _l10n_sa_check_vat_tin(self):
        """
            Check company VAT TIN according to ZATCA specifications: The VAT number should start and begin with a '3'
            and be 15 digits long
        """
        self.ensure_one()
        return bool(self.vat and re.match(r'^3[0-9]{13}3$', self.vat))

    def _l10n_sa_check_organization_unit(self):
        """
            Check company Organization Unit according to ZATCA specifications
        """
        self.ensure_one()
        if self.env['account.edi.format']._l10n_sa_check_vat_tin(self.vat) and self.vat[10] == '1':
            return bool(self.l10n_sa_organization_unit and re.match(r'^[0-9]{10}$', self.l10n_sa_organization_unit))
        return bool(self.l10n_sa_organization_unit)
