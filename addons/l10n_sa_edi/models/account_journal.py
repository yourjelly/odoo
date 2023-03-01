import json
import requests
from lxml import etree
from datetime import datetime
from base64 import b64encode, b64decode
from odoo import models, fields, service, _, api
from odoo.exceptions import UserError
from cryptography import x509
from cryptography.x509 import ObjectIdentifier, load_der_x509_certificate
from cryptography.x509.oid import NameOID
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.serialization import Encoding, load_pem_private_key
from odoo.modules.module import get_module_resource

ZATCA_API_URLS = {
    "sandbox": "https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal",
    "preprod": "https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation",
    "prod": "https://gw-fatoora.zatca.gov.sa/e-invoicing/core",
    "apis": {
        "ccsid": "/compliance",
        "pcsid": "/production/csids",
        "compliance": "/compliance/invoices",
        "reporting": "/invoices/reporting/single",
        "clearance": "/invoices/clearance/single",
    }
}

CERT_TEMPLATE_NAME = {
    'prod': b'\x0c\x12ZATCA-Code-Signing',
    'sandbox': b'\x13\x15PREZATCA-Code-Signing',
    'preprod': b'\x13\x15PREZATCA-Code-Signing',
}


class AccountJournal(models.Model):
    _inherit = 'account.journal'

    l10n_sa_csr = fields.Binary(attachment=False, copy=False, compute="_l10n_sa_compute_csr", store=True,
                                help="The Certificate Signing Request that is submitted to the Compliance API")

    l10n_sa_compliance_csid_json = fields.Char("CCSID JSON", copy=False,
                                               help="Compliance CSID data received from the Compliance CSID API "
                                                    "in dumped json format")
    l10n_sa_production_csid_json = fields.Char("PCSID JSON", copy=False,
                                               help="Production CSID data received from the Production CSID API "
                                                    "in dumped json format")
    l10n_sa_production_csid_validity = fields.Datetime("PCSID Expiration", help="Production CSID expiration date",
                                                       compute="_l10n_sa_compute_production_csid_validity", store=True)
    l10n_sa_compliance_checks_passed = fields.Boolean("Compliance Checks Done", default=False, copy=False,
                                                      help="Specifies if the Compliance Checks have been completed successfully")

    l10n_sa_chain_sequence_id = fields.Many2one('ir.sequence', string='ZATCA account.move chain sequence',
                                                readonly=True, copy=False)

    l10n_sa_serial_number = fields.Char("Serial Number", copy=False,
                                        help="The serial number of the Taxpayer solution unit. Provided by ZATCA")

    # ====== Utility Functions =======

    def _l10n_sa_get_zatca_datetime(self, timestamp):
        """
            Helper function that calls the _l10n_sa_get_zatca_datetime method available on the EDI Format model to
            format date times
        """
        return self.env.ref('l10n_sa_edi.edi_sa_zatca')._l10n_sa_get_zatca_datetime(timestamp)

    def _l10n_sa_ready_to_submit_einvoices(self):
        """
            Helper function to know if the required CSIDs have been obtained, and the compliance checks have been
            completed
        """
        self.ensure_one()
        # TODO Undo
        return True or self.l10n_sa_production_csid_json

    @api.model
    def _l10n_sa_sign_xml(self, xml_content, certificate_str, signature):
        """
            Helper function that calls the _l10n_sa_sign_xml method available on the EDI Format model to sign
            the UBL document of an invoice
        """
        return self.env.ref('l10n_sa_edi.edi_sa_zatca')._l10n_sa_sign_xml(xml_content, certificate_str, signature)

    # ====== CSR Generation =======

    def _l10n_sa_csr_required_fields(self):
        return ['l10n_sa_private_key', 'l10n_sa_organization_unit', 'vat', 'name', 'city', 'country_id', 'state_id']

    @api.depends('company_id.l10n_sa_private_key', 'l10n_sa_serial_number',
                 'company_id.l10n_sa_organization_unit', 'company_id.vat', 'company_id.name', 'company_id.city',
                 'company_id.country_id', 'company_id.state_id')
    def _l10n_sa_compute_csr(self):
        """
            Generate a certificate signing request (CSR) that will be used to obtain an X509 certificate from the
            ZATCA Compliance API
        """
        for journal in self:
            journal._l10n_sa_reset_certificates()
            if all(journal.company_id[f] for f in self._l10n_sa_csr_required_fields()) and journal.l10n_sa_serial_number:
                journal.l10n_sa_csr = journal._l10n_sa_generate_company_csr()

    def _l10n_sa_generate_company_csr(self):
        """
            Generate a ZATCA compliant CSR request that will be sent to the Compliance API in order to get back
            a signed X509 certificate
        """
        self.ensure_one()

        def _encode(s):
            """
                Some of the information included in the CSR could be in arabic, and thus needs to be encoded in a
                specific format in order to be compliant with the ZATCA CCSID/PCSID APIs
            """
            return s.encode('UTF-8').decode('CP1252')

        company_id = self.company_id
        version_info = service.common.exp_version()
        builder = x509.CertificateSigningRequestBuilder()
        subject_names = (
            # Country Name
            (NameOID.COUNTRY_NAME, company_id.country_id.code),
            # Organization Unit Name
            (NameOID.ORGANIZATIONAL_UNIT_NAME, company_id.l10n_sa_organization_unit),
            # Organization Name
            (NameOID.ORGANIZATION_NAME, _encode(company_id.name)),
            # # Subject Common Name
            (NameOID.COMMON_NAME, _encode(company_id.name)),
            # # Organization Identifier
            (ObjectIdentifier('2.5.4.97'), company_id.vat),
            # # State/Province Name
            (NameOID.STATE_OR_PROVINCE_NAME, _encode(company_id.state_id.name)),
            # # Locality Name
            (NameOID.LOCALITY_NAME, _encode(company_id.city)),
        )
        # The CertificateSigningRequestBuilder instances are immutable, which is why everytime we modify one,
        # we have to assign it back to itself to keep track of the changes
        builder = builder.subject_name(x509.Name([
            x509.NameAttribute(n[0], u'%s' % n[1]) for n in subject_names
        ]))

        x509_alt_names_extension = x509.SubjectAlternativeName([
            x509.DirectoryName(x509.Name([
                # EGS Serial Number. Manufacturer or Solution Provider Name, Model or Version and Serial Number.
                # To be written in the following format: "1-... |2-... |3-..."
                x509.NameAttribute(ObjectIdentifier('2.5.4.4'), '1-Odoo|2-%s|3-%s' % (
                    version_info['server_version_info'][0], self.l10n_sa_serial_number)),
                # Organisation Identifier (UID)
                x509.NameAttribute(NameOID.USER_ID, company_id.vat),
                # Invoice Type. 4-digit numerical input using 0 & 1
                x509.NameAttribute(NameOID.TITLE, company_id._l10n_sa_get_csr_invoice_type()),
                # Location
                x509.NameAttribute(ObjectIdentifier('2.5.4.26'), _encode(company_id.street)),
                # Industry
                x509.NameAttribute(ObjectIdentifier('2.5.4.15'), _encode(company_id.partner_id.industry_id.name or 'Other')),
            ]))
        ])

        x509_extensions = (
            # Add Certificate template name extension
            (x509.UnrecognizedExtension(ObjectIdentifier('1.3.6.1.4.1.311.20.2'),
                                        CERT_TEMPLATE_NAME[company_id.l10n_sa_api_mode]), False),
            # Add alternative names extension
            (x509_alt_names_extension, False),
        )

        for ext in x509_extensions:
            builder = builder.add_extension(ext[0], critical=ext[1])

        private_key = load_pem_private_key(company_id.l10n_sa_private_key, password=None, backend=default_backend())
        request = builder.sign(private_key, hashes.SHA256(), default_backend())

        return b64encode(request.public_bytes(Encoding.PEM)).decode()

    def l10n_sa_regen_csr(self):
        self.ensure_one()
        if any(not self.company_id[f] for f in self._l10n_sa_csr_required_fields()):
            raise UserError(_("Please, make sure all the following fields have been correctly set on the Company: \n")
                            + "\n".join(
                " - %s" % self.company_id._fields[f].string for f in self._l10n_sa_csr_required_fields() if
                not self.company_id[f]))
        self._l10n_sa_compute_csr()

    # ====== Certificate Methods =======

    @api.depends('l10n_sa_production_csid_json')
    def _l10n_sa_compute_production_csid_validity(self):
        """
            Compute the expiration date of the Production certificate
        """
        for journal in self:
            journal.l10n_sa_production_csid_validity = False
            if journal.l10n_sa_production_csid_json:
                journal.l10n_sa_production_csid_validity = self._l10n_sa_get_pcsid_validity(
                    json.loads(journal.l10n_sa_production_csid_json))

    def _l10n_sa_reset_certificates(self):
        """
            Reset all certificate values, including CSR and compliance checks
        """
        for journal in self:
            journal.l10n_sa_csr = False
            journal.l10n_sa_production_csid_json = False
            journal.l10n_sa_compliance_csid_json = False
            journal.l10n_sa_compliance_checks_passed = False

    def l10n_sa_api_get_compliance_CSID(self, otp):
        """
            Request a Compliance Cryptographic Stamp Identifier (CCSID) from ZATCA
        :return: Either raise an error in case the API returns one, or display a success notification
        """
        CCSID_data = self._l10n_sa_generate_compliance_csid(otp)
        if CCSID_data.get('error'):
            raise UserError(_("Could not obtain Compliance CSID: %s") % CCSID_data['error'])
        self.write({
            'l10n_sa_compliance_csid_json': json.dumps(CCSID_data),
            'l10n_sa_production_csid_json': False,
            'l10n_sa_compliance_checks_passed': False,
        })

    def l10n_sa_api_get_production_CSID(self, OTP=None):
        """
            Request a Production Cryptographic Stamp Identifier (PCSID) from ZATCA
        :return: Either raise an error in case the API returns one, or display a success notification
        """

        if not self.l10n_sa_compliance_csid_json:
            raise UserError(_("Cannot request a Production CSID before requesting a CCSID first"))
        elif not self.l10n_sa_compliance_checks_passed:
            raise UserError(_("Cannot request a Production CSID before completing the Compliance Checks"))

        renew = False

        if self.l10n_sa_production_csid_json:
            time_now = self._l10n_sa_get_zatca_datetime(datetime.now())
            if self._l10n_sa_get_zatca_datetime(self.l10n_sa_production_csid_validity) < time_now:
                renew = True
            else:
                raise UserError(_("The Production CSID is still valid. You can only renew it once it has expired."))

        CCSID_data = json.loads(self.l10n_sa_compliance_csid_json)
        PCSID_data = self._l10n_sa_generate_production_csid(CCSID_data, renew, OTP)
        if PCSID_data.get('error'):
            raise UserError(_("Could not obtain Production CSID: %s") % PCSID_data['error'])
        self.l10n_sa_production_csid_json = json.dumps(PCSID_data)

    # ====== Compliance Checks =======

    def _l10n_sa_get_compliance_files(self):
        """
            Return the list of files to be used for the compliance checks.
        """
        file_names, compliance_files = [
            'standard/invoice.xml', 'standard/credit.xml', 'standard/debit.xml',
            'simplified/invoice.xml', 'simplified/credit.xml', 'simplified/debit.xml',
        ], {}
        for file in file_names:
            fpath = get_module_resource('l10n_sa_edi', 'tests/compliance', file)
            with open(fpath, 'rb') as ip:
                compliance_files[file] = ip.read().decode()
        return compliance_files

    def l10n_sa_run_compliance_checks(self):
        """
            Run Compliance Checks once the CCSID has been obtained.

            The goal of the Compliance Checks is to make sure our system is able to produce, sign and send Invoices
            correctly. For this we use dummy invoice UBL files available under the tests/compliance folder:

            Standard Invoice, Standard Credit Note, Standard Debit Note, Simplified Invoice, Simplified Credit Note,
            Simplified Debit Note.

            We read each one of these files separately, sign them, then process them through the Compliance Checks API.
        """
        self.ensure_one()
        if self.country_code != 'SA':
            raise UserError(_("Compliance checks can only be run for companies operating from KSA"))
        if not self.l10n_sa_compliance_csid_json:
            raise UserError(_("You need to request the CCSID first before you can proceed"))
        edi_format = self.env.ref('l10n_sa_edi.edi_sa_zatca')
        CCSID_data = json.loads(self.l10n_sa_compliance_csid_json)
        compliance_files = self._l10n_sa_get_compliance_files()
        for fname, fval in compliance_files.items():
            invoice_hash_hex = self.env['account.edi.xml.ubl_21.zatca']._l10n_sa_generate_invoice_xml_hash(
                fval).decode()
            digital_signature = edi_format._l10n_sa_get_digital_signature(self.company_id, invoice_hash_hex).decode()
            prepared_xml = self._l10n_sa_prepare_compliance_xml(fname, fval, CCSID_data['binarySecurityToken'],
                                                                digital_signature)
            result = self._l10n_sa_api_compliance_checks(prepared_xml.decode(), CCSID_data)
            if result.get('error'):
                raise UserError(_("Could not complete Compliance Checks for the following file: %s") % fname)
            if result['validationResults']['status'] != 'PASS':
                raise UserError(_("Could not complete Compliance Checks for the following file: %s") % fname)
        self.l10n_sa_compliance_checks_passed = True

    def _l10n_sa_prepare_compliance_xml(self, xml_name, xml_raw, PCSID, signature):
        """
            Prepare XML content to be used for Compliance checks
        """
        xml_content = self._l10n_sa_prepare_invoice_xml(xml_raw)
        signed_xml = self._l10n_sa_sign_xml(xml_content, PCSID, signature)
        if xml_name.startswith('simplified'):
            qr_code_str = self.env['account.move']._l10n_sa_get_qr_code(self, signed_xml, b64decode(PCSID).decode(),
                                                                        signature, True)
            root = etree.fromstring(signed_xml)
            qr_node = root.xpath('//*[local-name()="ID"][text()="QR"]/following-sibling::*/*')[0]
            qr_node.text = b64encode(qr_code_str).decode()
            return etree.tostring(root, with_tail=False)
        return signed_xml

    def _l10n_sa_prepare_invoice_xml(self, xml_content):
        """
            Prepare the XML content of the test invoices before running the compliance checks
        """
        ubl_extensions = etree.fromstring(self.env.ref('l10n_sa_edi.export_sa_zatca_ubl_extensions')._render())
        root = etree.fromstring(xml_content.encode())
        root.insert(0, ubl_extensions)
        ns_map = self.env['account.edi.xml.ubl_21.zatca']._l10n_sa_get_namespaces()

        def _get_node(xpath_str):
            return root.xpath(xpath_str, namespaces=ns_map)[0]

        # Update the Company VAT number in the test invoice
        vat_el = _get_node('//cbc:CompanyID')
        vat_el.text = self.company_id.vat

        # Update the Company Name in the test invoice
        name_nodes = ['cac:PartyName/cbc:Name', 'cac:PartyLegalEntity/cbc:RegistrationName', 'cac:Contact/cbc:Name']
        for node in name_nodes:
            comp_name_el = _get_node('//cac:AccountingSupplierParty/cac:Party/' + node)
            comp_name_el.text = self.company_id.display_name

        return etree.tostring(root)

    # ====== Index Chain & Previous Invoice Calculation =======

    def _l10n_sa_edi_get_next_chain_index(self):
        self.ensure_one()
        if not self.l10n_sa_chain_sequence_id:
            self.l10n_sa_chain_sequence_id = self.env['ir.sequence'].create({
                'name': f'ZATCA account move sequence for Journal {self.name} (id: {self.id})',
                'code': f'l10n_sa_edi.account.move.{self.id}',
                'implementation': 'no_gap',
                'company_id': self.company_id.id,
            })
        return self.l10n_sa_chain_sequence_id.next_by_id()

    def _l10n_sa_get_last_posted_invoice(self):
        """
        Returns the last invoice posted to this journal's chain.
        That invoice may have been received by the govt or not (eg. in case of a timeout).
        Only upon confirmed reception/refusal of that invoice can another one be posted.
        """
        self.ensure_one()
        return self.env['account.move'].search(
            [
                ('journal_id', '=', self.id),
                ('l10n_sa_chain_index', '!=', 0)
            ],
            limit=1, order='l10n_sa_chain_index desc'
        )

    # ====== API Calls to ZATCA =======

    def _l10n_sa_api_get_compliance_CSID(self, otp):
        """
            API call to the Compliance CSID API to generate a CCSID certificate, password and compliance request_id
            Requires a CSR token and a One Time Password (OTP)
        """
        self.ensure_one()
        if not otp:
            raise UserError(_("Please, set a valid OTP to be used for Onboarding"))
        if not self.l10n_sa_csr:
            raise UserError(_("Please, generate a CSR before requesting a CCSID"))
        request_data = {
            'body': json.dumps({'csr': self.l10n_sa_csr.decode()}),
            'header': {'OTP': otp}
        }
        return self._l10n_sa_call_api(request_data, ZATCA_API_URLS['apis']['ccsid'], 'POST')

    def _l10n_sa_api_get_production_CSID(self, CCSID_data):
        """
            API call to the Production CSID API to generate a PCSID certificate, password and production request_id
            Requires a requestID from the Compliance CSID API
        """
        request_data = {
            'body': json.dumps({'compliance_request_id': str(CCSID_data['requestID'])}),
            'header': {'Authorization': self._l10n_sa_authorization_header(CCSID_data)}
        }
        return self._l10n_sa_call_api(request_data, ZATCA_API_URLS['apis']['pcsid'], 'POST')

    def _l10n_sa_api_renew_production_CSID(self, PCSID_data, OTP):
        """
            API call to the Production CSID API to renew a PCSID certificate, password and production request_id
            Requires an expired Production CSID
        """
        self.ensure_one()
        request_data = {
            'body': json.dumps({'csr': self.l10n_sa_csr.decode()}),
            'header': {
                'OTP': OTP,
                'Authorization': self._l10n_sa_authorization_header(PCSID_data)
            }
        }
        return self._l10n_sa_call_api(request_data, ZATCA_API_URLS['apis']['pcsid'], 'PATCH')

    def _l10n_sa_api_compliance_checks(self, xml_content, CCSID_data):
        """
            API call to the COMPLIANCE endpoint to generate a security token used for subsequent API calls
            Requires a CSR token and a One Time Password (OTP)
        """
        invoice_tree = etree.fromstring(xml_content)

        # Get the Invoice Hash from the XML document
        invoice_hash_node = invoice_tree.xpath('//*[@Id="invoiceSignedData"]/*[local-name()="DigestValue"]')[0]
        invoice_hash = invoice_hash_node.text

        # Get the Invoice UUID from the XML document
        invoice_uuid_node = invoice_tree.xpath('//*[local-name()="UUID"]')[0]
        invoice_uuid = invoice_uuid_node.text

        request_data = {
            'body': json.dumps({
                "invoiceHash": invoice_hash,
                "uuid": invoice_uuid,
                "invoice": b64encode(xml_content.encode()).decode()
            }),
            'header': {
                'Authorization': self._l10n_sa_authorization_header(CCSID_data),
                'Clearance-Status': '1'
            }
        }
        return self._l10n_sa_call_api(request_data, ZATCA_API_URLS['apis']['compliance'], 'POST')

    def _l10n_sa_get_api_clearance(self, invoice):
        """
            Return the API to be used for clearance. To be overridden to account for other cases, such as reporting.
        """
        return ZATCA_API_URLS['apis']['reporting' if invoice._l10n_sa_is_simplified() else 'clearance']

    def _l10n_sa_api_clearance(self, invoice, xml_content, PCSID_data):
        """
            API call to the CLEARANCE/REPORTING endpoint to sign an invoice
                - If SIMPLIFIED invoice: Reporting
                - If STANDARD invoice: Clearance
        """
        invoice_tree = etree.fromstring(xml_content)
        invoice_hash_node = invoice_tree.xpath('//*[@Id="invoiceSignedData"]/*[local-name()="DigestValue"]')[0]
        invoice_hash = invoice_hash_node.text
        request_data = {
            'body': json.dumps({
                "invoiceHash": invoice_hash,
                "uuid": invoice.l10n_sa_uuid,
                "invoice": b64encode(xml_content.encode()).decode()
            }),
            'header': {
                'Authorization': self._l10n_sa_authorization_header(PCSID_data),
                'Clearance-Status': '1'
            }
        }
        url_string = self._l10n_sa_get_api_clearance(invoice)
        return self._l10n_sa_call_api(request_data, url_string, 'POST')

    # ====== Certificate Methods =======

    def _l10n_sa_generate_compliance_csid(self, otp):
        """
            Generate company Compliance CSID data
        """
        self.ensure_one()
        CCSID_data = self._l10n_sa_api_get_compliance_CSID(otp)
        if not CCSID_data.get('error'):
            json.dumps(CCSID_data)
        return CCSID_data

    def _l10n_sa_get_pcsid_validity(self, PCSID_data):
        """
            Return PCSID expiry date
        """
        b64_decoded_pcsid = b64decode(PCSID_data['binarySecurityToken'])
        x509_certificate = load_der_x509_certificate(b64decode(b64_decoded_pcsid.decode()), default_backend())
        return x509_certificate.not_valid_after

    def _l10n_sa_generate_production_csid(self, csid_data, renew=False, otp=None):
        """
            Generate company Production CSID data
        """
        self.ensure_one()
        if renew:
            PCSID_data = self._l10n_sa_api_renew_production_CSID(csid_data, otp)
        else:
            PCSID_data = self._l10n_sa_api_get_production_CSID(csid_data)
        return PCSID_data

    def _l10n_sa_api_get_pcsid(self):
        """
            Get CSIDs required to perform ZATCA api calls, and regenerate them if they need to be regenerated.
        """
        self.ensure_one()
        if not self.l10n_sa_production_csid_json:
            raise UserError("Please, make a request to obtain the Compliance CSID and Production CSID before sending "
                            "documents to ZATCA")
        pcsid_validity = self._l10n_sa_get_zatca_datetime(self.l10n_sa_production_csid_validity)
        time_now = self._l10n_sa_get_zatca_datetime(datetime.now())
        if pcsid_validity < time_now:
            raise UserError(_("Production certificate has expired, please renew the PCSID before proceeding"))
        return json.loads(self.l10n_sa_production_csid_json)

    # ====== API Helper Methods =======

    def _l10n_sa_call_api(self, request_data, request_url, method):
        """
            Helper function to make api calls to the ZATCA API Endpoint
        :param dict request_data: data to be sent along with the request
        :param str request_url: URI used for the request
        :param str method: HTTP method used for the request (ex: POST, GET)
        :return: Results of the API call
        :rtype: dict
        """
        api_url = ZATCA_API_URLS[self.env.company.l10n_sa_api_mode]
        request_url = api_url + request_url
        try:
            request_response = requests.request(method, request_url, data=request_data.get('body'),
                                                headers={
                                                    **self._l10n_sa_api_headers(),
                                                    **request_data.get('header')
                                                }, timeout=(30, 30))
        except (ValueError, requests.exceptions.RequestException) as ex:
            return {
                'error': str(ex),
                'blocking_level': 'warning',
                'excepted': True
            }

        # Authentication errors do not return json
        if request_response.status_code == 401:
            return {
                'error': _("API %s could not be authenticated") % request_url,
                'blocking_level': 'error'
            }

        if request_response.status_code in (303, 400, 404, 500, 409, 502, 503):
            return {'error': request_response.text, 'blocking_level': 'error'}

        try:
            response_data = request_response.json()
        except json.decoder.JSONDecodeError as e:
            return {
                'error': _("JSON response from ZATCA could not be decoded"),
                'blocking_level': 'error'
            }

        if not request_response.ok and (response_data.get('errors') or response_data.get('warnings')):
            if isinstance(response_data, dict) and response_data.get('errors'):
                return {
                    'error': _("Invoice submission to ZATCA returned errors"),
                    'json_errors': response_data['errors'],
                    'blocking_level': 'error',
                }
            return {
                'error': request_response.reason,
                'blocking_level': 'error'
            }
        return response_data

    def _l10n_sa_api_headers(self):
        """
            Return the base headers to be included in ZATCA API calls
        :return:
        """
        return {
            'Content-Type': 'application/json',
            'Accept-Language': 'en',
            'Accept-Version': 'V2'
        }

    def _l10n_sa_authorization_header(self, CSID_data):
        """
            Compute the Authorization header by combining the CSID and the Secret key, then encode to Base64
        :param CSID_data: Either CCSID or PCSID data
        :return: Authorization Header
        """
        auth_str = "%s:%s" % (CSID_data['binarySecurityToken'], CSID_data['secret'])
        return 'Basic ' + b64encode(auth_str.encode()).decode()
