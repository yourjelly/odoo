# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.


import json
from base64 import b64encode

from odoo import models, api, _
import logging
import requests
from odoo.exceptions import ValidationError

_logger = logging.getLogger(__name__)


class AccountEdiFormat(models.Model):
    _inherit = 'account.edi.format'

    @api.model
    def _l10n_eg_get_eta_api_domain(self):
        api_domain = self.env['ir.config_parameter'].sudo().get_param('default.eta.domain')
        if not api_domain:
            raise ValidationError(_('Please set API domain of ETA first.'))
        return api_domain

    @api.model
    def _l10n_eg_get_eta_token_domain(self):
        token_domain = self.env['ir.config_parameter'].sudo().get_param('default.eta.token.domain')
        if not token_domain:
            raise ValidationError(_('Please set token domain of ETA first.'))
        return token_domain

    @api.model
    def _l10n_eg_get_einvoice_token(self, invoice):
        token = False
        user = invoice.company_id.l10n_eg_client_identifier
        secret = invoice.company_id.l10n_eg_client_secret_1 or invoice.company_id.l10n_eg_client_secret_2
        access = '%s:%s' % (user, secret)
        user_and_pass = b64encode(bytes(access, encoding='utf8')).decode('ascii')
        token_domain = self._l10n_eg_get_eta_token_domain()
        request_url = '%s/connect/token' % token_domain
        request_payload = {
            'grant_type': 'client_credentials',
        }
        headers = {'Authorization': 'Basic ' + user_and_pass}
        try:
            request_response = requests.post(request_url, data=request_payload, headers=headers, timeout=(5, 10))
            if request_response:
                response_data = request_response.json()
                token = response_data.get('access_token')
            return token
        except Exception as ex:
            raise ValidationError(_('action code: 1006 \n%s' % ex))

    def _l10n_eg_get_eta_invoice(self, uuid, invoice, token=False):
        self.ensure_one()

        api_domain = self._l10n_eg_get_eta_api_domain()
        request_url = '%s/api/v1/documents/%s/raw' % (api_domain, uuid)

        if not token:
            token = self._l10n_eg_get_einvoice_token(invoice)
        request_payload = {}
        headers = {'Content-Type': 'application/json', 'Authorization': 'Bearer %s' % token}
        try:
            request_response = requests.request('GET', request_url, headers=headers, data=request_payload,
                                                timeout=(5, 10))
            if request_response:
                _logger.warning(
                    'GET Document: %s, response code: %s' % (request_response.text, request_response.status_code))
            if request_response.status_code in [404, 200]:
                return request_response.json()
            else:
                return {
                    'error': request_response.text
                }
        except Exception as ex:
            return {
                'error': _('Document cannot be reached. \n%s' % ex)
            }

    def _l10n_eg_get_eta_invoice_pdf(self, uuid, invoice, token=False):
        api_domain = self._get_eta_api_domain()
        request_url = '%s/api/v1/documents/%s/pdf' % (api_domain, uuid)
        if not token:
            token = self._l10n_eg_get_einvoice_token(invoice)
        request_payload = {}
        headers = {'Content-Type': 'application/json', 'Authorization': 'Bearer %s' % token}
        try:
            request_response = requests.request('GET', request_url, headers=headers, data=request_payload,
                                                timeout=(5, 10))
            _logger.warning('PDF Function Response %s.' % request_response)
            if request_response:
                _logger.warning('PDF Function %s.' % request_response.text)
            if request_response.status_code in [404, 200]:
                return request_response.content
            else:
                return {
                    'error': request_response.text
                }
        except Exception as ex:
            return {
                'error': _('PDF Not Reached. \n%s' % ex)
            }

    def _l10n_eg_eta_prepare_eta_invoice(self, invoice):
        total_discount = invoice.l10n_eg_total_without_discount
        total_sale_amount = invoice.l10n_eg_total_discount
        date_string = invoice.l10n_eg_posted_datetime.strftime('%Y-%m-%dT%H:%M:%SZ')
        eta_invoice = {
            'issuer': self._l10n_eg_eta_prepare_address_data(invoice.l10n_eg_branch_id, issuer=True),
            'receiver': self._l10n_eg_eta_prepare_address_data(invoice.partner_id),
            'documentType': 'I' if invoice.move_type == 'out_invoice' else 'c' if invoice.move_type == 'out_refund' else 'd' if invoice.move_type == 'in_refund' else '',
            'documentTypeVersion': '1.0',
            'dateTimeIssued': date_string,
            'taxpayerActivityCode': invoice.l10n_eg_branch_id.l10n_eg_activity_type_id.code,
            'internalID': invoice.name,
            'purchaseOrderReference': '',
            'purchaseOrderDescription': '',
            'salesOrderReference': invoice.invoice_origin or '',
            'salesOrderDescription': '',
            'proformaInvoiceNumber': '',
        }
        if invoice.move_type in ['out_refund', 'in_refund']:
            eta_invoice.update({
                'references': [invoice.reversed_entry_id.l10n_eg_uuid] if invoice.move_type == 'out_refund' and invoice.reversed_entry_id and invoice.reversed_entry_id.l10n_eg_uuid else []
            })
        eta_invoice.update({
            'payment': self._l10n_eg_eta_prepare_payment_data(invoice),
            'delivery': self._l10n_eg_eta_prepare_delivery_data(invoice),
            'invoiceLines': self._l10n_eg_eta_prepare_invoice_lines_data(invoice),
            'totalDiscountAmount': invoice._get_amount_main_currency(total_discount) or 0,
            'totalSalesAmount': invoice._get_amount_main_currency(total_sale_amount),
            'netAmount': invoice._get_amount_main_currency(invoice.amount_untaxed),
            'taxTotals': [{
                'taxType': self.env['account.tax.template'].search([('tax_group_id', '=', tax[6])]).l10n_eg_eta_code,
                'amount': invoice._get_amount_main_currency(abs(tax[1])) or 0,
            } for tax in invoice.l10n_eg_amount_by_group],
            'totalAmount': invoice._get_amount_main_currency(invoice.amount_total),
            'extraDiscountAmount': 0,
            'totalItemsDiscountAmount': 0,
            'signatures': [
                {
                    'signatureType': 'I',
                    'value': invoice.l10n_eg_signature_data
                }
            ]
        })

        return eta_invoice

    def _l10n_eg_eta_prepare_invoice_lines_data(self, invoice):
        lines = []
        for line in invoice.invoice_line_ids:
            discount = (line.discount / 100.0) * line.quantity * line.price_unit
            lines.append({
                'description': line.name,
                'itemType': line.product_id.l10n_eg_item_type if line.product_id.l10n_eg_item_type else 'GS1',
                'itemCode': line.product_id.l10n_eg_item_code,
                'unitType': line.product_uom_id.l10n_eg_unit_code_id.code,
                'quantity': line.quantity,
                'internalCode': line.product_id.default_code or '',
                'salesTotal': invoice._get_amount_main_currency(line.quantity * line.price_unit),
                'total': invoice._get_amount_main_currency(invoice.amount_total),
                'valueDifference': 0,
                'totalTaxableFees': 0,
                'netTotal': invoice._get_amount_main_currency(line.price_subtotal),
                'itemsDiscount': 0,
                'unitValue': {
                    'currencySold': invoice.currency_id.name,
                    'amountEGP': invoice._get_amount_main_currency(line.price_unit),
                    'amountSold': 0 if line.price_unit == invoice._get_amount_main_currency(
                        line.price_unit) else round(line.price_unit, 5),
                    'currencyExchangeRate': invoice._exchange_currency_rate(),
                },
                'discount': {
                    'rate': line.discount or 0,
                    'amount': discount or 0,
                },
                'taxableItems': [
                    {
                        'taxType': tax.l10n_eg_eta_code,
                        'amount': invoice._get_amount_main_currency(abs((tax.amount / 100.0) * line.price_subtotal)) or 0,
                        'subType': tax.l10n_eg_eta_code,
                        'rate': invoice._get_amount_main_currency(abs(tax.amount)) or 0,
                    } for tax in line.tax_ids
                ],
            })
        return lines

    def _l10n_eg_eta_prepare_payment_data(self, invoice):
        if not invoice.partner_bank_id:
            return {
                'bankName': '',
                'bankAddress': '',
                'bankAccountNo': '',
                'bankAccountIBAN': '',
                'swiftCode': '',
                'terms': invoice.invoice_payment_term_id.name if invoice.invoice_payment_term_id else ''
            }
        bank = invoice.partner_bank_id
        payment = {
            'bankName': bank.bank_id.name,
            'bankAddress': '%s' % bank.bank_id.street,
            'bankAccountNo': bank.acc_number,
            'bankAccountIBAN': '',
            'swiftCode': '',
            'terms': invoice.invoice_payment_term_id.name if invoice.invoice_payment_term_id else '',
        }
        return payment

    # FIXME need to filled
    def _l10n_eg_eta_prepare_delivery_data(self, invoice):
        delivery = {
            'approach': '',
            'packaging': '',
            'dateValidity': '',
            'exportPort': '',
            'grossWeight': 0,
            'netWeight': 0,
            'terms': ''
        }
        return delivery

    def _l10n_eg_eta_prepare_address_data(self, partner_id, issuer=False):
        address = {
            'address': {
                'country': partner_id.country_id.code,
                'governate': partner_id.state_id.name or '',
                'regionCity': partner_id.city or '',
                'street': partner_id.street or '',
                'buildingNumber': partner_id.l10n_eg_building_no or '',
                'postalCode': partner_id.zip or '',
                'floor': partner_id.l10n_eg_floor or '',
                'room': partner_id.l10n_eg_room or '',
                'landmark': partner_id.l10n_eg_landmark or '',
                'additionalInformation': partner_id.l10n_eg_additional_information or '',
            },
            'type': 'B',
            'id': partner_id.vat,
            'name': partner_id.name,
        }
        if issuer:
            address['address']['branchID'] = partner_id.l10n_eg_branch_identifier or ''
        return address

    # -------------------------------------------------------------------------
    # EDI OVERRIDDEN METHODS
    # -------------------------------------------------------------------------

    def _needs_web_services(self):
        return self.code == 'eg_eta' or super()._needs_web_services()

    def _post_invoice_edi(self, invoices):
        # OVERRIDE
        if self.code != 'eg_eta':
            return super()._post_invoice_edi(invoices)

        invoice = invoices  # Batching is disabled for this EDI.

        invoice_json = self._l10n_eg_eta_prepare_eta_invoice(invoice)

        res = self._l10n_eg_edi_post_invoice_web_service(invoice, invoice_json)

        if res.get(invoice, {}).get('success'):
            attachment = self.env['ir.attachment'].create({
                'type': 'binary',
                'name': 'jsondump.json',
                'raw': json.dumps(invoice_json),
                'mimetype': 'application/json',
                'res_model': invoice._name,
                'res_id': invoice.id,
            })
            res[invoice]['attachment'] = attachment

        return res

    def _l10n_eg_edi_post_invoice_web_service(self, invoice, invoice_json):
        token = self._l10n_eg_get_einvoice_token(invoice)
        api_domain = self._l10n_eg_get_eta_api_domain()
        request_url = '%s/api/v1/documentsubmissions' % api_domain

        request_payload = {
            'documents': [invoice_json]
        }

        data = json.dumps(request_payload, ensure_ascii=False, indent=4).encode('utf-8')

        try:
            headers = {'Content-Type': 'application/json', 'Authorization': 'Bearer %s' % token}
            request_response = requests.post(request_url, data=data, headers=headers, timeout=(5, 10))
            if not request_response:
                return {invoice: {
                    'error': _('The web service is not responding'),
                    'blocking_level': 'warning'
                }}
            submission_data = request_response.json()
            if submission_data:
                if submission_data.get('error'):
                    return {invoice: {
                        'error': submission_data.get('error'),
                        'blocking_level': 'warning'
                    }}

                if submission_data.get('rejectedDocuments', False) and isinstance(
                        submission_data.get('rejectedDocuments'), list):
                    return {invoice: {
                        'error': str(submission_data.get('rejectedDocuments')[0].get('error')),
                        'blocking_level': 'warning'
                    }}

                if submission_data.get('submissionId') and not submission_data.get('submissionId') is None:
                    if submission_data.get('acceptedDocuments'):
                        invoice.l10n_eg_submission_id = submission_data.get('submissionId')
                        uuid = submission_data.get('acceptedDocuments')[0].get('uuid')
                        invoice.l10n_eg_uuid = uuid
                        invoice.l10n_eg_long_id = submission_data.get('acceptedDocuments')[0].get('longId')
                        invoice.l10n_eg_internal_id = submission_data.get('acceptedDocuments')[0].get('internalId')
                        invoice.l10n_eg_hash_key = submission_data.get('acceptedDocuments')[0].get('hashKey')
                        return {invoice: {
                            'l10n_eg_uuid': uuid,
                            'success': True
                        }}

            return {invoice: {
                'success': False,
            }}
        except Exception as error:
            return {invoice: {
                'error': str(error),
                'blocking_level': 'error'
            }}

    def _cancel_invoice_edi(self, invoices):
        # OVERRIDE
        if self.code != 'eg_eta':
            return super()._cancel_invoice_edi(invoices)

        invoice = invoices

        api_domain = self._l10n_eg_get_eta_api_domain()
        request_url = '%s/api/v1/documents/state/%s/state' % (api_domain, invoice.l10n_eg_uuid)
        token = self._l10n_eg_get_einvoice_token(invoice)
        request_payload = {
            'status': 'cancelled',
            'reason': 'Cancelled'
        }
        data = json.dumps(request_payload)
        headers = {'Content-Type': 'application/json', 'Authorization': 'Bearer %s' % token}
        request_response = requests.request('PUT', request_url, headers=headers, data=data, timeout=(5, 10))
        if request_response.status_code in [500, 400, 200]:
            get_invoice_data = request_response.json()
            return {invoice: {
                'success': True,
                'data': get_invoice_data
            }}
        else:
            return {invoice: {
                'error': request_response.text,
                'blocking_level': 'warning'
            }}

    def _get_invoice_edi_content(self, move):
        if self.code != 'eg_eta':
            return super()._get_invoice_edi_content(move)
        return json.dumps(self._l10n_eg_eta_prepare_eta_invoice(move)).encode()

    def _is_compatible_with_journal(self, journal):
        # OVERRIDE
        if self.code != 'eg_eta':
            return super()._is_compatible_with_journal(journal)

        return journal.country_code == 'EG'
