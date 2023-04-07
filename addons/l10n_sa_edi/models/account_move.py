import uuid
import json
from odoo import fields, models, api
from odoo.tools import float_repr
from datetime import datetime
from base64 import b64decode, b64encode
from lxml import etree
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from cryptography.hazmat.backends import default_backend
from cryptography.x509 import load_der_x509_certificate


class AccountMove(models.Model):
    _inherit = 'account.move'

    l10n_sa_uuid = fields.Char(string='Document UUID', copy=False, help="Universally unique identifier of the Invoice")

    l10n_sa_invoice_signature = fields.Char("Unsigned XML Signature", copy=False)

    l10n_sa_chain_index = fields.Integer(
        string="ZATCA chain index", copy=False, readonly=True,
        help="Invoice index in chain, set if and only if an in-chain XML was submitted and did not error",
    )

    l10n_sa_submission_ids = fields.One2many("l10n_sa_edi.submission", "l10n_sa_move_id", string="Submitted Documents")

    def _l10n_sa_is_simplified(self):
        """
            Returns True if the customer is an individual, i.e: The invoice is B2C
        :return:
        """
        self.ensure_one()
        return self.partner_id.company_type == 'person'

    @api.depends('amount_total_signed', 'amount_tax_signed', 'l10n_sa_confirmation_datetime', 'company_id',
                 'company_id.vat', 'journal_id', 'journal_id.l10n_sa_production_csid_json',
                 'l10n_sa_invoice_signature', 'l10n_sa_chain_index')
    def _compute_qr_code_str(self):
        """ Override to update QR code generation in accordance with ZATCA Phase 2"""
        for move in self:
            move.l10n_sa_qr_code_str = ''
            if move.country_code == 'SA' and move.move_type in ('out_invoice', 'out_refund') and move.l10n_sa_chain_index:
                edi_format = self.env.ref('l10n_sa_edi.edi_sa_zatca')
                zatca_document = move.edi_document_ids.filtered(lambda d: d.edi_format_id == edi_format)
                if move._l10n_sa_is_simplified():
                    x509_cert = json.loads(move.journal_id.l10n_sa_production_csid_json)['binarySecurityToken']
                    xml_content = self.env.ref('l10n_sa_edi.edi_sa_zatca')._l10n_sa_generate_zatca_template(move)
                    qr_code_str = move._l10n_sa_get_qr_code(move.journal_id, xml_content, b64decode(x509_cert), move.l10n_sa_invoice_signature, move._l10n_sa_is_simplified())
                    move.l10n_sa_qr_code_str = b64encode(qr_code_str).decode()
                elif zatca_document.state == 'sent' and zatca_document.attachment_id.datas:
                    document_xml = zatca_document.attachment_id.datas.decode()
                    root = etree.fromstring(b64decode(document_xml))
                    qr_node = root.xpath('//*[local-name()="ID"][text()="QR"]/following-sibling::*/*')[0]
                    move.l10n_sa_qr_code_str = qr_node.text


    def _l10n_sa_get_qr_code_encoding(self, tag, field, int_length=1):
        """
            Helper function to encode strings for the QR code generation according to ZATCA specs
        """
        company_name_tag_encoding = tag.to_bytes(length=1, byteorder='big')
        company_name_length_encoding = len(field).to_bytes(length=int_length, byteorder='big')
        return company_name_tag_encoding + company_name_length_encoding + field

    @api.model
    def _l10n_sa_get_qr_code(self, journal_id, unsigned_xml, x509_cert, signature, is_b2c=False):
        """
            Generate QR code string based on XML content of the Invoice UBL file, X509 Production Certificate
            and company info.

            :return b64 encoded QR code string
        """

        def xpath_ns(expr):
            return root.xpath(expr, namespaces=edi_format._l10n_sa_get_namespaces())[0].text.strip()

        qr_code_str = ''
        root = etree.fromstring(unsigned_xml)
        edi_format = self.env['account.edi.xml.ubl_21.zatca']

        # Indent XML content to avoid indentation mismatches
        etree.indent(root, space='    ')

        invoice_date = xpath_ns('//cbc:IssueDate')
        invoice_time = xpath_ns('//cbc:IssueTime')
        invoice_datetime = datetime.strptime(invoice_date + ' ' + invoice_time, '%Y-%m-%d %H:%M:%S')

        if invoice_datetime and journal_id.company_id.vat and x509_cert:
            prehash_content = etree.tostring(root)
            invoice_hash = edi_format._l10n_sa_generate_invoice_xml_hash(prehash_content, 'digest')

            amount_total = float(xpath_ns('//cbc:TaxInclusiveAmount'))
            amount_tax = float(xpath_ns('//cac:TaxTotal/cbc:TaxAmount'))
            x509_certificate = load_der_x509_certificate(b64decode(x509_cert), default_backend())
            seller_name_enc = self._l10n_sa_get_qr_code_encoding(1, journal_id.company_id.display_name.encode())
            seller_vat_enc = self._l10n_sa_get_qr_code_encoding(2, journal_id.company_id.vat.encode())
            timestamp_enc = self._l10n_sa_get_qr_code_encoding(3,
                                                               invoice_datetime.strftime("%Y-%m-%dT%H:%M:%SZ").encode())
            amount_total_enc = self._l10n_sa_get_qr_code_encoding(4, float_repr(abs(amount_total), 2).encode())
            amount_tax_enc = self._l10n_sa_get_qr_code_encoding(5, float_repr(abs(amount_tax), 2).encode())
            invoice_hash_enc = self._l10n_sa_get_qr_code_encoding(6, invoice_hash)
            signature_enc = self._l10n_sa_get_qr_code_encoding(7, signature.encode())
            public_key_enc = self._l10n_sa_get_qr_code_encoding(8,
                                                                x509_certificate.public_key().public_bytes(Encoding.DER,
                                                                                                           PublicFormat.SubjectPublicKeyInfo))

            qr_code_str = (seller_name_enc + seller_vat_enc + timestamp_enc + amount_total_enc +
                           amount_tax_enc + invoice_hash_enc + signature_enc + public_key_enc)

            if is_b2c:
                qr_code_str += self._l10n_sa_get_qr_code_encoding(9, x509_certificate.signature)

        return qr_code_str

    def _l10n_sa_get_previous_submission(self):
        """
            Get the previously submitted EDI document, whether it was accepted or rejected.
        """
        return self.env['l10n_sa_edi.submission'].search(
            [('l10n_sa_move_id.journal_id', '=', self.journal_id.id), ('l10n_sa_xml_content', '!=', False)], limit=1)

    @api.depends('state', 'edi_document_ids.state')
    def _compute_edi_show_cancel_button(self):
        """
            Override to hide the EDI Cancellation button at all times for ZATCA Invoices
        """
        super()._compute_edi_show_cancel_button()
        for move in self.filtered(lambda m: m.is_invoice() and m.country_code == 'SA'):
            move.edi_show_cancel_button = False

    # todo: remove after testing
    def regen_xml(self):
        edi_format = self.env.ref('l10n_sa_edi.edi_sa_zatca')
        # Build the dict of values to be used for generating the Invoice XML content
        # Set Invoice field values required for generating the XML content, hash and signature
        self.l10n_sa_uuid = uuid.uuid4()
        return edi_format._l10n_sa_generate_zatca_template(self)

    def _l10n_sa_generate_unsigned_data(self):
        """
            Generate Unsigned XML content & digital signature to be used during both Signing and QR code generation.
            It is necessary to save the signature as it changes everytime it is generated and both the signing and the
            QR code expect to have the same, identical signature.
        """
        self.ensure_one()
        edi_format = self.env.ref('l10n_sa_edi.edi_sa_zatca')
        # Build the dict of values to be used for generating the Invoice XML content
        # Set Invoice field values required for generating the XML content, hash and signature
        self.l10n_sa_uuid = uuid.uuid4()
        # Once the required values are generated, we hash the invoice, then use it to generate a Signature
        invoice_hash_hex = self.env['account.edi.xml.ubl_21.zatca']._l10n_sa_generate_invoice_xml_hash(
            edi_format._l10n_sa_generate_zatca_template(self)).decode()
        self.l10n_sa_invoice_signature = edi_format._l10n_sa_get_digital_signature(self.journal_id.company_id,
                                                                                   invoice_hash_hex).decode()

    def _l10n_sa_save_submission(self, xml_content, response_data=None, error=False):
        """
            Save submitted invoice XML content in case of either Rejection or Acceptance.
            This is useful to figure out why an invoice was rejected since we also save the errors along with the state.
        """
        self.ensure_one()
        self.sudo().l10n_sa_submission_ids = [(0, 0, {
            "l10n_sa_move_id": self.id,
            "l10n_sa_chain_index": self.l10n_sa_chain_index,
            "l10n_sa_xml_content": b64encode(xml_content),
            "l10n_sa_status": "rejected" if (error or (response_data and response_data.get('error'))) else "accepted",
            "l10n_sa_errors": json.dumps(response_data),
        })]

    def _l10n_sa_ensure_line_taxes(self):
        """
            All invoice lines submitted to ZATCA need to have at least one Tax applied
        """
        self.ensure_one()
        return all(line.tax_ids for line in self.invoice_line_ids.filtered(lambda line: not line.display_type))

    def _l10n_sa_download_xml_content(self):
        self.ensure_one()
        att_id = self.env['ir.attachment'].search([('res_model', '=', 'account.move'), ('res_id', '=', self.id), ('name', '=', 'zatca_xml.xml')])
        if att_id:
            att_id.unlink()
        xml_content = self.env.ref('l10n_sa_edi.edi_sa_zatca')._l10n_sa_generate_zatca_template(self)
        root = etree.fromstring(xml_content)
        root.remove(root.xpath('//ext:UBLExtensions', namespaces=self.env['account.edi.xml.ubl_21.zatca']._l10n_sa_get_namespaces())[0])
        att_id = self.env['ir.attachment'].create({
            'res_model': 'account.move',
            'res_id': self.id,
            'name': 'zatca_xml.xml',
            'type': 'binary',
            'raw': etree.tostring(root)
        })
        return {
            'type': 'ir.actions.act_url',
            'name': 'Download XML',
            'target': '_blank',
            'url': '/web/content/%s/zatca_xml.xml' % (att_id.id)
        }