# Part of Odoo. See LICENSE file for full copyright and licensing details.
from lxml import etree

from odoo import models, _
from odoo.tools import html2plaintext, cleanup_xml_node


class ApplicationResponse2(models.AbstractModel):
    _name = "account.edi.xml.ubl_application_response_2"
    _inherit = 'account.edi.xml.ubl_bis3'
    _description = "UBL ApplicationResponse-2"

    def _get_document_response_status_vals(self, statuses):
        return [{
            'attrs': {'listID': status['status_type']},
            'status_code':  {
                'OPStatusReason': status['reason_code'],
                'OPStatusAction': status['action_code'],
            }[status['status_type']],
            'conditions': status['conditions']
        } for status in statuses.read(['status_type', 'reason_code', 'action_code', 'conditions'])]

    def _get_document_response_vals(self, invoice_response):

        invoice = invoice_response.move_id
        return {
            'response': {
                'code': invoice_response.code,
                'effective_date': invoice_response.date,
                'statuses': self._get_document_response_status_vals(invoice_response.status_ids)
            },
            'document_reference': {
                'invoice_identifier': invoice.name if invoice.is_sale_document() else invoice.ref,
                'invoice_issue_date': invoice.invoice_date.isoformat(),
                'document_type_code': 383 if 'debit_origin_id' in invoice._fields and invoice.debit_origin_id else {
                    'out_refund': 381,
                    'out_invoice': 380,
                    'in_refund': 381,
                    'in_invoice': 380,
                }.get(invoice.move_type),
            },
            'issuer_party_identification': '',
            'issuer_party_name': '',
            'recipient_party_identification': '',
            'recipient_party_name': '',
        }

    def _export_invoice_response_vals(self, invoice_response):

        supplier = invoice_response.company_id.partner_id.commercial_partner_id
        customer = invoice_response.partner_id

        vals = {
            'builder': self,
            'invoice': invoice_response.move_id,
            'supplier': supplier,
            'customer': customer,

            'PartyType_template': 'account_peppol_invoice_response.ubl_invoice_response_PartyType',
            'DocumentResponse_template': 'account_peppol_invoice_response.ubl_invoice_response_DocumentResponse',

            'response_identifier': f'imr-{invoice_response.id}',
            'sender_party_vals': self._get_partner_party_vals(supplier, role='supplier'),
            'receiver_party_vals': self._get_partner_party_vals(customer, role='customer'),
            'document_response': self._get_document_response_vals(invoice_response),
        }
        return vals

    def _export_invoice_response(self, invoice_response):
        vals = self._export_invoice_response_vals(
            invoice_response.with_context(lang=invoice_response.partner_id.lang),
        )
        xml_content = self.env['ir.qweb']._render('account_peppol_invoice_response.ubl_invoice_response_ApplicationResponse', vals)
        return etree.tostring(cleanup_xml_node(xml_content), xml_declaration=True, encoding='UTF-8')
