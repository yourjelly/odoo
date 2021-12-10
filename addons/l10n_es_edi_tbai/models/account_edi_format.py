# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import math
from base64 import b64encode
from collections import defaultdict
from datetime import datetime
from uuid import uuid4
from re import sub as regex_sub

import xmlsig
from cryptography.hazmat.primitives import hashes
from lxml import etree
from odoo import _, fields, models
from odoo.tools import get_lang, html_escape
from requests import exceptions

from .requests_pkcs12 import post
from .res_company import L10N_ES_EDI_TBAI_VERSION

import io
import zipfile


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

    def _get_invoice_edi_content(self, invoice):
        pass  # TODO

    def _post_invoice_edi(self, invoices):
        print("=== STARTING TO POST %s ===" % invoices.name)

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

        self.ensure_one()  # TODO loop should not be necessary
        for inv in invoices:
            # Get TicketBai response
            res_xml = res[inv]['response']
            message, tbai_id = self.get_response_values(res_xml)

            # SUCCESS
            if res.get(inv, {}).get('success'):

                #     # Track head of chain (last posted invoice) # TODO replace by _compute from unzipped attachment
                #     inv.company_id.write({'l10n_es_tbai_last_posted_id': inv})

                # Zip together invoice & response
                with io.BytesIO() as stream:
                    raw1 = etree.tostring(inv_xml, pretty_print=True, xml_declaration=True, encoding='UTF-8')
                    raw2 = etree.tostring(res_xml, pretty_print=True, xml_declaration=True, encoding='UTF-8')
                    stream = self.zip_files([raw1, raw2], [inv.name + ".xml", inv.name + "_response.xml"], stream)

                    # Create attachment & post to chatter
                    attachment = self.env['ir.attachment'].create({
                        'type': 'binary',
                        'name': inv.name + ".zip",
                        'raw': stream.getvalue(),
                        'mimetype': 'application/zip'
                    })
                    inv.with_context(no_new_invoice=True).message_post(
                        body="TicketBAI: submitted XML and response",
                        attachment_ids=attachment.ids)
                    res[inv]['attachment'] = attachment  # save zip as EDI document

            # Put sent XML in chatter (TODO remove)
            attachment = self.env['ir.attachment'].create({
                'type': 'binary',
                'name': inv.name + '.xml',
                'raw': etree.tostring(inv_xml, pretty_print=True, xml_declaration=True, encoding='UTF-8'),
                'mimetype': 'application/xml',
            })
            inv.with_context(no_new_invoice=True).message_post(
                body="TicketBai: invoice XML (TODO remove)",
                attachment_ids=attachment.ids)

            # Put response + any warning/error in chatter (TODO remove)
            if message:
                attachment = self.env['ir.attachment'].create({
                    'type': 'binary',
                    'name': inv.name + '_response.xml',
                    'raw': etree.tostring(res_xml, pretty_print=True, xml_declaration=True, encoding='UTF-8'),
                    'mimetype': 'application/xml',
                })
                inv.with_context(no_new_invoice=True).message_post(
                    body="<pre>TicketBai: response\n" + message + '</pre>',
                    attachment_ids=attachment.ids)
        print("=== FINISHED POSTING %s ===" % invoices.name)
        return res

    def zip_files(self, files, fnames, stream):
        """
        : param fnct_sort : Function to be passed to "key" parameter of built-in
                            python sorted() to provide flexibility of sorting files
                            inside ZIP archive according to specific requirements.
        """

        with zipfile.ZipFile(stream, 'w', compression=zipfile.ZIP_DEFLATED) as zipf:
            for file, fname in zip(files, fnames):
                fname = regex_sub("/", "-", fname)  # slashes create directory structure
                zipf.writestr(fname, file)
        return stream

    # -------------------------------------------------------------------------
    # TBAI XML BUILD
    # -------------------------------------------------------------------------

    def _l10n_es_tbai_get_invoice_xml(self, invoice):
        values = self._l10n_es_tbai_get_header_values(invoice)
        values.update(self._l10n_es_tbai_get_subject_values(invoice))
        values.update(self._l10n_es_tbai_get_invoice_values(invoice))
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
            xml_recipients.append(values_dest)
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

    def _l10n_es_tbai_get_invoice_values(self, invoices):
        eu_country_codes = set(self.env.ref('base.europe').country_ids.mapped('code'))

        # simplified_partner = self.env.ref("l10n_es_edi_tbai.partner_simplified")

        values = {}
        for invoice in invoices:
            com_partner = invoice.commercial_partner_id

            # === CABECERA===
            values['SerieFactura'] = invoice.l10n_es_tbai_sequence
            values['NumFactura'] = invoice.l10n_es_tbai_number
            values['FechaExpedicionFactura'] = datetime.strftime(datetime.now(), '%d-%m-%Y')  # TODO use existing registration datetime if canceling/correcting it
            values['HoraExpedicionFactura'] = datetime.strftime(datetime.now(), '%H:%M:%S')

            # TODO simplified & rectified invoices
            # is_simplified = invoice.partner_id == simplified_partner
            # if invoice.move_type == 'out_invoice':
            #     invoice_node['TipoFactura'] = 'F2' if is_simplified else 'F1'
            # elif invoice.move_type == 'out_refund':
            #     invoice_node['TipoFactura'] = 'R5' if is_simplified else 'R1'
            #     invoice_node['TipoRectificativa'] = 'I'

            # === DATOS FACTURA ===
            values['DescripcionFactura'] = invoice.invoice_origin or 'manual'
            detalles = []
            # tax_details = self._l10n_es_tbai_get_invoice_tax_details_values(invoice)
            for line in invoice.invoice_line_ids.filtered(lambda line: not line.display_type):
                # line_details = tax_details['tax_details']['invoice_line_tax_details'][line]
                detalles.append({
                    "DescripcionDetalle": regex_sub(r"[^0-9a-zA-Z ]", "", line.name)[:250],
                    "Cantidad": line.quantity,
                    "ImporteUnitario": line.price_unit,
                    "Descuento": line.discount or "0.00",
                    "ImporteTotal": line.price_total,
                })
            values['DetallesFactura'] = detalles

            # Claves: TODO there's 15 more codes to implement, there can be up to 3
            if not com_partner.country_id or com_partner.country_id.code in eu_country_codes:
                values['ClaveRegimenIvaOpTrascendencia'] = '01'
            else:
                values['ClaveRegimenIvaOpTrascendencia'] = '02'

            # === TIPO DESGLOSE ===
            if com_partner.country_id.code in ('ES', False) and not (com_partner.vat or '').startswith("ESN"):
                tax_details_info_vals = self._l10n_es_tbai_get_invoice_tax_details_values(invoice)
                values['DesgloseFactura'] = tax_details_info_vals['tax_details_info']
                values['ImporteTotalFactura'] = round(tax_details_info_vals['tax_details']['base_amount']
                                                      + tax_details_info_vals['tax_details']['tax_amount']
                                                      - tax_details_info_vals['tax_amount_retention'], 2)

            else:
                tax_details_info_service_vals = self._l10n_es_tbai_get_invoice_tax_details_values(
                    invoice,
                    filter_invl_to_apply=lambda x: any(t.tax_scope == 'service' for t in x.tax_ids)
                )
                tax_details_info_consu_vals = self._l10n_es_tbai_get_invoice_tax_details_values(
                    invoice,
                    filter_invl_to_apply=lambda x: any(t.tax_scope == 'consu' for t in x.tax_ids)
                )

                if tax_details_info_service_vals['tax_details_info']:
                    values['PrestacionServicios'] = tax_details_info_service_vals['tax_details_info']
                if tax_details_info_consu_vals['tax_details_info']:
                    values['EntregaBienes'] = tax_details_info_consu_vals['tax_details_info']

                values['ImporteTotalFactura'] = round(
                    tax_details_info_service_vals['tax_details']['base_amount']
                    + tax_details_info_service_vals['tax_details']['tax_amount']
                    - tax_details_info_service_vals['tax_amount_retention']
                    + tax_details_info_consu_vals['tax_details']['base_amount']
                    + tax_details_info_consu_vals['tax_details']['tax_amount']
                    - tax_details_info_consu_vals['tax_amount_retention'], 2)

        return values

    def _l10n_es_tbai_get_invoice_tax_details_values(self, invoice, filter_invl_to_apply=None):

        def grouping_key_generator(tax_values):
            tax = tax_values['tax_id']
            return {
                'applied_tax_amount': tax.amount,
                'l10n_es_type': tax.l10n_es_type,
                'l10n_es_exempt_reason': tax.l10n_es_exempt_reason if tax.l10n_es_type == 'exento' else False,
                'l10n_es_bien_inversion': tax.l10n_es_bien_inversion,
            }

        def filter_to_apply(tax_values):
            # For intra-community, we do not take into account the negative repartition line
            return tax_values['tax_repartition_line_id'].factor_percent > 0.0

        def full_filter_invl_to_apply(invoice_line):
            if 'ignore' in invoice_line.tax_ids.flatten_taxes_hierarchy().mapped('l10n_es_type'):
                return False
            return filter_invl_to_apply(invoice_line) if filter_invl_to_apply else True

        tax_details = invoice._prepare_edi_tax_details(
            grouping_key_generator=grouping_key_generator,
            filter_invl_to_apply=full_filter_invl_to_apply,
            filter_to_apply=filter_to_apply,
        )
        sign = -1 if invoice.is_sale_document() else 1

        tax_details_info = defaultdict(dict)

        # Detect for which is the main tax for 'recargo'. Since only a single combination tax + recargo is allowed
        # on the same invoice, this can be deduced globally.

        recargo_tax_details = {}  # Mapping between main tax and recargo tax details
        invoice_lines = invoice.invoice_line_ids.filtered(lambda x: not x.display_type)
        if filter_invl_to_apply:
            invoice_lines = invoice_lines.filtered(filter_invl_to_apply)
        for line in invoice_lines:
            taxes = line.tax_ids.flatten_taxes_hierarchy()
            recargo_tax = [t for t in taxes if t.l10n_es_type == 'recargo']
            if recargo_tax and taxes:
                recargo_main_tax = taxes.filtered(lambda x: x.l10n_es_type in ('sujeto', 'sujeto_isp'))[:1]
                if not recargo_tax_details.get(recargo_main_tax):
                    recargo_tax_details[recargo_main_tax] = [
                        x for x in tax_details['tax_details'].values()
                        if x['group_tax_details'][0]['tax_id'] == recargo_tax[0]
                    ][0]

        tax_amount_deductible = 0.0
        tax_amount_retention = 0.0
        base_amount_not_subject = 0.0
        base_amount_not_subject_loc = 0.0
        tax_subject_info_list = []
        tax_subject_isp_info_list = []
        for tax_values in tax_details['tax_details'].values():

            if tax_values['l10n_es_type'] in ('sujeto', 'sujeto_isp'):
                tax_amount_deductible += tax_values['tax_amount']

                base_amount = sign * tax_values['base_amount']
                tax_info = {
                    'TipoImpositivo': tax_values['applied_tax_amount'],
                    'BaseImponible': round(base_amount, 2),
                    'CuotaRepercutida': round(math.copysign(tax_values['tax_amount'], base_amount), 2),
                }

                recargo = recargo_tax_details.get(tax_values['group_tax_details'][0]['tax_id'])
                if recargo:
                    tax_info['CuotaRecargoEquivalencia'] = round(sign * recargo['tax_amount'], 2)
                    tax_info['TipoRecargoEquivalencia'] = recargo['applied_tax_amount']

                if tax_values['l10n_es_type'] == 'sujeto':
                    tax_subject_info_list.append(tax_info)
                else:
                    tax_subject_isp_info_list.append(tax_info)

            elif tax_values['l10n_es_type'] == 'exento':
                tax_details_info['Sujeta'].setdefault('Exenta', {'DetalleExenta': []})
                tax_details_info['Sujeta']['Exenta']['DetalleExenta'].append({
                    'BaseImponible': round(sign * tax_values['base_amount'], 2),
                    'CausaExencion': tax_values['l10n_es_exempt_reason'],
                })
            elif tax_values['l10n_es_type'] == 'retencion':
                tax_amount_retention += tax_values['tax_amount']
            elif tax_values['l10n_es_type'] == 'no_sujeto':
                base_amount_not_subject += tax_values['base_amount']
            elif tax_values['l10n_es_type'] == 'no_sujeto_loc':
                base_amount_not_subject_loc += tax_values['base_amount']
            elif tax_values['l10n_es_type'] == 'ignore':
                continue

            if tax_subject_isp_info_list and not tax_subject_info_list:
                tax_details_info['Sujeta']['NoExenta'] = {'TipoNoExenta': 'S2'}
            elif not tax_subject_isp_info_list and tax_subject_info_list:
                tax_details_info['Sujeta']['NoExenta'] = {'TipoNoExenta': 'S1'}
            elif tax_subject_isp_info_list and tax_subject_info_list:
                tax_details_info['Sujeta']['NoExenta'] = {'TipoNoExenta': 'S3'}

            if tax_subject_info_list:
                tax_details_info['Sujeta']['NoExenta'].setdefault('DesgloseIVA', {})
                tax_details_info['Sujeta']['NoExenta']['DesgloseIVA'].setdefault('DetalleIVA', [])
                tax_details_info['Sujeta']['NoExenta']['DesgloseIVA']['DetalleIVA'] += tax_subject_info_list
            if tax_subject_isp_info_list:
                tax_details_info['Sujeta']['NoExenta'].setdefault('DesgloseIVA', {})
                tax_details_info['Sujeta']['NoExenta']['DesgloseIVA'].setdefault('DetalleIVA', [])
                tax_details_info['Sujeta']['NoExenta']['DesgloseIVA']['DetalleIVA'] += tax_subject_isp_info_list

        if not invoice.company_id.currency_id.is_zero(base_amount_not_subject) and invoice.is_sale_document():
            tax_details_info['NoSujeta']['ImportePorArticulos7_14_Otros'] = round(sign * base_amount_not_subject, 2)
        if not invoice.company_id.currency_id.is_zero(base_amount_not_subject_loc) and invoice.is_sale_document():
            tax_details_info['NoSujeta']['ImporteTAIReglasLocalizacion'] = round(sign * base_amount_not_subject_loc, 2)

        return {
            'tax_details_info': tax_details_info,
            'tax_details': tax_details,
            'tax_amount_deductible': tax_amount_deductible,
            'tax_amount_retention': tax_amount_retention,
            'base_amount_not_subject': base_amount_not_subject,
        }

    def _l10n_es_tbai_get_trail_values(self, invoice):
        prev_invoice = invoice.company_id.l10n_es_tbai_last_posted_id
        if prev_invoice:
            return {
                'EncadenamientoFacturaAnterior': True,
                'SerieFacturaAnterior': prev_invoice.l10n_es_tbai_sequence,
                'NumFacturaAnterior': prev_invoice.l10n_es_tbai_number,
                'FechaExpedicionFacturaAnterior': datetime.strftime(prev_invoice.l10n_es_tbai_registration_date, '%d-%m-%Y'),
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

        # All invoices share the same value, see '_get_batch_key'.
        # TBAID only exists if invoice has already been successfully submitted to gov.
        tbai_id = invoices.mapped('l10n_es_tbai_id')[0]

        xml_str = etree.tostring(invoice_xml, encoding='UTF-8')

        # === Call the web service ===

        # Get connection data #TODO cancel parameter
        url = company.l10n_es_tbai_url_invoice  # company.l10n_es_tbai_url_cancel if tbai_id else company.l10n_es_tbai_url_invoice
        header = {"Content-Type": "application/xml; charset=UTF-8"}
        cert_file = company.l10n_es_tbai_certificate_id.get_file()
        password = company.l10n_es_tbai_certificate_id.get_password()

        # Post and retrieve response
        response = post(url=url, data=xml_str, headers=header, pkcs12_data=cert_file, pkcs12_password=password, timeout=30)
        data = response.content.decode(response.encoding)

        # Error management
        response_xml = etree.fromstring(bytes(data, 'utf-8'))
        message, tbai_id = self.get_response_values(response_xml)
        state = int(response_xml.find(r'.//Estado').text)
        if state == 0:
            # SUCCESS
            return {invoices: {'success': True, 'response': response_xml}}
        else:
            # ERROR
            return {invoices: {
                'success': False, 'error': _(message), 'blocking_level': 'error',
                'response': response_xml}}

    def get_response_values(self, xml_res):
        tbai_id_node = xml_res.find(r'.//IdentificadorTBAI')
        tbai_id = '' if tbai_id_node is None else tbai_id_node.text
        messages = ''
        node_name = 'Azalpena' if get_lang(self.env).code == 'eu_ES' else 'Descripcion'
        for xml_res_node in xml_res.findall(r'.//ResultadosValidacion'):
            messages += xml_res_node.find('Codigo').text + ": " + xml_res_node.find(node_name).text + "\n"
        return messages, tbai_id

    # TODO remove static method (make it private)
    @ staticmethod
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
