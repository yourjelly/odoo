# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import os
from base64 import b64encode
from datetime import datetime
from uuid import uuid4

import xmlsig
import re as regex
from cryptography.hazmat.primitives import hashes
from lxml import etree
from lxml.objectify import fromstring
from odoo import _, fields, models
from odoo.tools import html_escape, get_lang
from requests import exceptions

from .requests_pkcs12 import post
from .res_company import L10N_ES_EDI_TBAI_VERSION


class AccountEdiFormat(models.Model):
    _inherit = 'account.edi.format'

    # -------------------------------------------------------------------------
    # EDI OVERRIDDEN METHODS
    # -------------------------------------------------------------------------

    def _is_required_for_invoice(self, invoice):
        # OVERRIDE
        if self.code != 'es_tbai':
            return super()._is_required_for_invoice(invoice)

        return invoice.l10n_es_tbai_is_required

    def _needs_web_services(self):
        # OVERRIDE
        return self.code == 'es_tbai' or super()._needs_web_services()

    def _is_compatible_with_journal(self, journal):
        # OVERRIDE
        if self.code != 'es_tbai':
            return super()._is_compatible_with_journal(journal)

        return journal.country_code == 'ES'

    def _post_invoice_edi(self, invoices):
        # OVERRIDE
        if self.code != 'es_tbai':
            return super()._post_invoice_edi(invoices)

        # Ensure a certificate is available.
        certificate = invoices.company_id.l10n_es_tbai_certificate_id
        if not certificate:
            return {inv: {
                'error': _("Please configure the certificate for TicketBai."),
                'blocking_level': 'error',
            } for inv in invoices}

        # Ensure a tax agency is available.
        tax_agency = invoices.company_id.mapped('l10n_es_tbai_tax_agency')[0]
        if not tax_agency:
            return {inv: {
                'error': _("Please specify a tax agency on your company for TicketBai."),
                'blocking_level': 'error',
            } for inv in invoices}

        # Generate the XML values.
        inv_xml = self._l10n_es_tbai_get_invoice_xml(invoices)

        # Call the web service and get response
        signature = self._l10n_es_tbai_sign_invoice(invoices, inv_xml)
        res = self._l10n_es_tbai_post_to_web_service(invoices, inv_xml, signature)

        # Create attachment & post to chatter
        for inv in invoices:  # TODO loop should not be necessary, use ensure_one() ?
            if res.get(inv, {}).get('success'):
                attachment = self.env['ir.attachment'].create({
                    'type': 'binary',
                    'name': inv.name,
                    'raw': etree.tostring(inv_xml, pretty_print=True, xml_declaration=True, encoding='UTF-8'),
                    'mimetype': 'application/xml',
                    'res_model': inv._name,
                    'res_id': inv.id,
                })
                res[inv]['attachment'] = attachment
                inv.with_context(no_new_invoice=True).message_post(
                    body="TicketBAI mockup document",
                    attachment_ids=attachment.ids)
        return res

    # -------------------------------------------------------------------------
    # TBAI XML BUILD
    # -------------------------------------------------------------------------

    def _l10n_es_tbai_get_invoice_xml(self, invoice):
        values = self._l10n_es_tbai_get_header_values(invoice)
        values.update(self._l10n_es_tbai_get_subject_values(invoice))
        values.update(self._l10n_es_tbai_get_move_values(invoice))
        values.update(self._l10n_es_tbai_get_trail_values(invoice))
        xml_str = self.env.ref('l10n_es_edi_tbai.template_invoice_bundle')._render(values)

        xml_doc = etree.fromstring(xml_str, etree.XMLParser(compact=True, remove_blank_text=True, remove_comments=True))

        return xml_doc

    def _l10n_es_tbai_get_header_values(self, invoice):
        return {
            'IDVersionTBAI': L10N_ES_EDI_TBAI_VERSION
        }

    def _l10n_es_tbai_get_subject_values(self, invoice):
        xml_recipients = []

        # === PARTNERS ===
        # TODO multiple partners ?
        for dest in (1,):
            eu_country_codes = set(self.env.ref('base.europe').country_ids.mapped('code'))
            partner = invoice.commercial_partner_id if invoice.is_sale_document() else invoice.company_id

            NIF = False
            IDOtro_Code = False
            IDOtro_ID = partner.vat or 'NO_DISPONIBLE'
            IDOtro_Type = ""
            if (not partner.country_id or partner.country_id.code == 'ES') and partner.vat:
                # ES partner with VAT.
                NIF = partner.vat[2:] if partner.vat.startswith('ES') else partner.vat
            elif partner.country_id.code in eu_country_codes:
                # European partner
                IDOtro_Type = '02'
            else:
                if partner.vat:
                    IDOtro_Type = '04'
                else:
                    IDOtro_Type = '06'
                if partner.country_id:
                    IDOtro_Code = partner.country_id.code

            values_dest = {
                'NIF': NIF,
                'IDOtro_CodigoPais': IDOtro_Code,
                'IDOtro_ID': IDOtro_ID,
                'IDOtro_IDType': IDOtro_Type,
                'ApellidosNombreRazonSocial': partner.name,
                'CodigoPostal': partner.zip,
                'Direccion': ", ".join(filter(lambda x: x, [partner.street, partner.street2, partner.city]))
            }
            xml_recipients.append(self.env.ref('l10n_es_edi_tbai.template_invoice_destinatarios')._render(values_dest))
        # TODO check that less than 100 recipients (max for TBAI) ?

        # === SENDER ===
        sender = invoice.company_id if invoice.is_sale_document() else invoice.commercial_partner_id
        return {
            'Emisor': sender,
            'EmisorVAT': sender.vat[2:] if sender.vat.startswith('ES') else sender.vat,
            'Destinatarios': xml_recipients,
            'VariosDestinatarios': "N",  # TODO
            'TerceroODestinatario': "D"  # TODO
        }

    def _l10n_es_tbai_get_move_values(self, invoice):
        return {}

    def _l10n_es_tbai_get_trail_values(self, invoice):
        prev_invoice = invoice.company_id.l10n_es_tbai_last_posted_id
        if prev_invoice:
            return {
                'EncadenamientoFacturaAnterior': True,
                'SerieFacturaAnterior': prev_invoice.l10n_es_tbai_sequence,
                'NumFacturaAnterior': prev_invoice.l10n_es_tbai_number,
                'FechaExpedicionFacturaAnterior': datetime.strftime(prev_invoice.date, '%d-%m-%Y'),
                'FirmaFacturaAnterior': prev_invoice.l10n_es_tbai_signature[:100]
            }
        else:
            return {
                'EncadenamientoFacturaAnterior': False
            }

    def _l10n_es_tbai_sign_invoice(self, invoices, invoice_xml):
        company = invoices.company_id

        # Sign the XML document (modified in-place)
        private, public = company.l10n_es_tbai_certificate_id.get_key_pair()
        signature = AccountEdiFormat.sign(invoice_xml, (private, public))

        return signature

    # -------------------------------------------------------------------------
    # TBAI SERVER CALLS
    # -------------------------------------------------------------------------

    def _l10n_es_tbai_post_to_web_service(self, invoices, invoice_xml, signature):
        company = invoices.company_id

        # Set registration date (TODO only do that after successful post ?)
        invoices.filtered(lambda inv: not inv.l10n_es_registration_date).write({
            'l10n_es_registration_date': fields.Date.context_today(self),
        })

        # All invoices share the same value, see '_get_batch_key'.
        # TBAID only exists if invoice has already been successfully submitted to gov.
        tbai_id = invoices.mapped('l10n_es_tbai_id')[0]

        xml_str = etree.tostring(invoice_xml, pretty_print=True, xml_declaration=True, encoding='UTF-8')

        # === Call the web service ===

        # Get connection data. TODO use session w/ timeout ?
        url = company.l10n_es_tbai_url_cancel if tbai_id else company.l10n_es_tbai_url_invoice
        header = {"Content-Type": "application/xml; charset=UTF-8"}
        cert_file = company.l10n_es_tbai_certificate_id.get_file()
        password = company.l10n_es_tbai_certificate_id.get_password()

        # Post and retrieve response
        response = post(url=url, data=xml_str, headers=header, pkcs12_data=cert_file, pkcs12_password=password)
        data = response.content.decode(response.encoding)

        # Error management
        response_xml = etree.fromstring(bytes(data, 'utf-8'))
        state = int(response_xml.find(r'.//Estado').text)
        if state == 0:
            # SUCCESS
            invoices.write({'l10n_es_tbai_previous_invoice_id': company.l10n_es_tbai_last_posted_id})
            invoices.write({'l10n_es_tbai_signature': signature})
            company.write({'l10n_es_tbai_last_posted_id': invoices})
            return {invoices: {'success': True}}
        else:
            # ERROR
            results = response_xml.find(r'.//ResultadosValidacion')
            message = results.find('Codigo').text + ": " + \
                (results.find(r'Azalpena').text if get_lang(self.env).code == 'eu_ES' else results.find(r'Descripcion').text)
            print(message)
            return {invoices: {'success': state == 0, 'error': _(message), 'blocking_level': 'warning'}}

    @staticmethod
    def sign(root, certificate):
        """
        Sign XML with PKCS #12
        :param certificate: (private key, x509 certificate)
        :return: SignatureValue
        """

        def create_node_tree(root_node, elem_list):
            """Convierte una lista en XML.

            Cada elemento de la lista se interpretará de la siguiente manera:

            Si es un string se añadirá al texto suelto del nodo root.
            Si es una tupla/lista t se interpretará como sigue:
                t[0]  es el nombre del elemento a crear. Puede tener prefijo de espacio
                de nombres.
                t[1]  es la lista de atributos donde las posiciones pares son claves y
                los impares valores.
                t[2:] son los subelementos que se interpretan recursivamente
            """
            for elem_def in elem_list:
                if isinstance(elem_def, str):
                    root_node.text = (root_node.text or "") + elem_def
                else:
                    ns = ""
                    elemname = elem_def[0]
                    attrs = elem_def[1]
                    children = elem_def[2:]
                    if ":" in elemname:
                        ns, elemname = elemname.split(":")
                        ns = root_node.nsmap[ns]
                    node = xmlsig.utils.create_node(elemname, root_node, ns)
                    for attr_name, attr_value in zip(attrs[::2], attrs[1::2]):
                        node.set(attr_name, attr_value)
                    create_node_tree(node, children)

        doc_id = "id-" + str(uuid4())
        signature_id = "sig-" + doc_id
        kinfo_id = "ki-" + doc_id
        sp_id = "sp-" + doc_id
        signature = xmlsig.template.create(
            xmlsig.constants.TransformInclC14N,
            xmlsig.constants.TransformRsaSha256,
            signature_id,
        )
        ref = xmlsig.template.add_reference(
            signature, xmlsig.constants.TransformSha256, uri=""
        )
        xmlsig.template.add_transform(ref, xmlsig.constants.TransformEnveloped)
        xmlsig.template.add_reference(
            signature, xmlsig.constants.TransformSha256, uri="#" + kinfo_id
        )
        xmlsig.template.add_reference(
            signature, xmlsig.constants.TransformSha256, uri="#" + sp_id
        )
        ki = xmlsig.template.ensure_key_info(signature, name=kinfo_id)
        data = xmlsig.template.add_x509_data(ki)
        xmlsig.template.x509_data_add_certificate(data)
        xmlsig.template.add_key_value(ki)
        ctx = xmlsig.SignatureContext()
        ctx.x509 = certificate[1]
        ctx.public_key = ctx.x509.public_key()
        ctx.private_key = certificate[0]
        dslist = (
            "ds:Object",
            (),
            (
                "etsi:QualifyingProperties",
                ("Target", signature_id),
                (
                    "etsi:SignedProperties",
                    ("Id", sp_id),
                    (
                        "etsi:SignedSignatureProperties",
                        (),
                        ("etsi:SigningTime", (), datetime.now().isoformat()),
                        (
                            "etsi:SigningCertificateV2",
                            (),
                            (
                                "etsi:Cert",
                                (),
                                (
                                    "etsi:CertDigest",
                                    (),
                                    (
                                        "ds:DigestMethod",
                                        (
                                            "Algorithm",
                                            "http://www.w3.org/2000/09/xmldsig#sha256",
                                        ),
                                    ),
                                    (
                                        "ds:DigestValue",
                                        (),
                                        b64encode(
                                            ctx.x509.fingerprint(hashes.SHA256())
                                        ).decode(),
                                    ),
                                ),
                            ),
                        ),
                        (
                            "etsi:SignaturePolicyIdentifier",
                            (),
                            (
                                "etsi:SignaturePolicyId",
                                (),
                                (
                                    "etsi:SigPolicyId",
                                    (),
                                    (
                                        "etsi:Identifier",
                                        (),
                                        "http://ticketbai.eus/politicafirma",
                                    ),
                                    (
                                        "etsi:Description",
                                        (),
                                        "Política de Firma TicketBAI 1.0",
                                    ),
                                ),
                                (
                                    "etsi:SigPolicyHash",
                                    (),
                                    (
                                        "ds:DigestMethod",
                                        (
                                            "Algorithm",
                                            "http://www.w3.org/2000/09/xmldsig#sha256",
                                        ),
                                    ),
                                    (
                                        "ds:DigestValue",
                                        (),
                                        "lX1xDvBVAsPXkkJ7R07WCVbAm9e0H33I1sCpDtQNkbc=",
                                    ),
                                ),
                            ),
                        ),
                    ),
                ),
            ),
        )
        root.append(signature)
        create_node_tree(signature, [dslist])
        ctx.sign(signature)
        signature_value = signature.find(
            "ds:SignatureValue", namespaces=xmlsig.constants.NS_MAP
        ).text
        # RFC2045 - Base64 Content-Transfer-Encoding (page 25)
        # Any characters outside of the base64 alphabet are to be ignored in
        # base64-encoded data.
        return signature_value.replace("\n", "")
