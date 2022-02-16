# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.


import json
from base64 import b64encode

from odoo import models, api, _
import logging
import requests
from odoo.exceptions import ValidationError
from werkzeug.urls import url_quote
from requests.exceptions import ConnectionError as ReqConnectionError, HTTPError, InvalidSchema, InvalidURL, ReadTimeout

_logger = logging.getLogger(__name__)


class AccountEdiFormat(models.Model):
    _inherit = 'account.edi.format'

    @api.model
    def _l10n_eg_get_eta_api_domain(self):
        if not self.env.company.l10n_eg_production:
            self.env['ir.config_parameter'].sudo().get_param(
                'default.eta.preproduction.domain')
        return self.env['ir.config_parameter'].sudo().get_param('default.eta.production.domain')

    @api.model
    def _l10n_eg_get_eta_token_domain(self):
        if not self.env.company.l10n_eg_production:
            self.env['ir.config_parameter'].sudo().get_param(
                'default.eta.token.production.domain')
        return self.env['ir.config_parameter'].sudo().get_param('default.eta.token.production.domain')

    @api.model
    def _l10n_eg_get_einvoice_token(self, invoice):
        user = invoice.company_id.l10n_eg_client_identifier
        secret = invoice.company_id.l10n_eg_client_secret_1
        access = '%s:%s' % (user, secret)
        user_and_pass = b64encode(bytes(access, encoding='utf8')).decode('ascii')
        token_domain = self._l10n_eg_get_eta_token_domain()
        request_url = '%s/connect/token' % token_domain
        request_payload = {
            'grant_type': 'client_credentials',
        }
        headers = {'Authorization': f'Basic {user_and_pass}'}
        try:
            request_response = requests.post(
                request_url, data=request_payload, headers=headers, timeout=(5, 10))
            response_data = request_response.json()
            if request_response.status_code == 400:
                return {
                    'error': response_data.get('error', 'Unknown error'),
                    'blocking_level': 'error'
                }
            return response_data.get('access_token') or {
                'error': 'Unable to retrieve ETA token',
                'blocking_level': 'warning'
                }
        except Exception as ex:
            return {
                'error': _('Please try again later. Error: \n%s' % ex),
                'blocking_level': 'warning'
            }

    def _l10n_eg_validate_tax_codes(self, invoice):
        return all(tax.l10n_eg_eta_code for tax in invoice.invoice_line_ids.tax_ids)

    def _l10n_eg_validate_uom_codes(self, invoice):
        return all(account_move_line.product_uom_id.l10n_eg_unit_code_id.code for account_move_line in invoice.invoice_line_ids)

    def _l10n_eg_validate_item_codes(self, invoice):
        return all(account_move_line.product_id.l10n_eg_item_type and account_move_line.product_id.l10n_eg_item_code for account_move_line in invoice.invoice_line_ids)

    def _l10n_eg_validate_info_address(self, partner_id, issuer=False):
        fields = ["country_id",
                  "state_id", "city", "street",
                  "l10n_eg_building_no"]
        vat_fields = ['vat']  # company registeration, vat, national id.
        # TODO add logic for branches.
        issuer_only_fields = ['l10n_eg_branch_identifier']
        return all(partner_id[field] for field in fields+vat_fields)

    def _l10n_eg_get_eta_invoice_pdf(self, uuid, invoice):
        api_domain = self._l10n_eg_get_eta_api_domain()
        request_url = '%s/api/v1.0/documents/%s/pdf' % (api_domain, uuid)
        token = self._l10n_eg_get_einvoice_token(invoice)
        if isinstance(token, dict) and token.get('error'):
            return {
                'error': token.get('error', False),
                'blocking_level': token.get('blocking_level', False)
            }
        request_payload = {}
        headers = {'Content-Type': 'application/json',
                   'Authorization': 'Bearer %s' % token}
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
        # TODO: we will have to do something for all the datetime for existing invoices. (post-init?)
        date_string = invoice.l10n_eg_posted_datetime.strftime('%Y-%m-%dT%H:%M:%SZ')
        signature_value = invoice.l10n_eg_signature_data or 'TESTING'
        edi_values = invoice._prepare_edi_vals_to_export()

        def group_tax_retention(tax_values):
            return {'l10n_eg_eta_code': tax_values['tax_id'].l10n_eg_eta_code.split('_')[0]}
        grouped_taxes = invoice._prepare_edi_tax_details(
            grouping_key_generator=group_tax_retention)['tax_details'].values()
        eta_invoice = {
            'issuer': self._l10n_eg_eta_prepare_address_data(invoice.l10n_eg_branch_id, issuer=True),
            'receiver': self._l10n_eg_eta_prepare_address_data(invoice.partner_id),
            'documentType': 'I' if invoice.move_type == 'out_invoice' else 'c' if invoice.move_type == 'out_refund' else 'd' if invoice.move_type == 'in_refund' else '',
            'documentTypeVersion': '1.0',
            'dateTimeIssued': date_string,
            'taxpayerActivityCode': invoice.l10n_eg_branch_id.l10n_eg_activity_type_id.code,
            'internalID': invoice.name,
        }
        if invoice.move_type in ['out_refund', 'in_refund']:
            eta_invoice.update({
                'references': [invoice.reversed_entry_id.l10n_eg_uuid] if invoice.move_type == 'out_refund' and invoice.reversed_entry_id and invoice.reversed_entry_id.l10n_eg_uuid else []
            })
        eta_invoice.update({
            'payment': self._l10n_eg_eta_prepare_payment_data(invoice),
            'invoiceLines': self._l10n_eg_eta_prepare_invoice_lines_data(invoice),
            'totalDiscountAmount': edi_values['total_price_discount'],
            'totalSalesAmount': edi_values['total_price_subtotal_before_discount'],
            'netAmount': invoice._get_amount_main_currency(invoice.amount_untaxed),
            'taxTotals': [{
                'taxType': tax['l10n_eg_eta_code'].split('_')[0].upper(),
                #TODO: do we still do ABS for whithholding tax?
                'amount':abs(tax['tax_amount_currency']),
            } for tax in grouped_taxes],
            'totalAmount': invoice._get_amount_main_currency(invoice.amount_total),
            'extraDiscountAmount': 0,
            'totalItemsDiscountAmount': 0,
            'signatures': [
                {
                    'signatureType': 'I',
                    'value': signature_value
                }
            ]
        })

        return eta_invoice

    def _l10n_eg_eta_prepare_invoice_lines_data(self, invoice):
        lines = []
        for line in invoice.invoice_line_ids:
            discount = (line.discount / 100.0) * \
                line.quantity * line.price_unit
            lines.append({
                'description': line.name,
                'itemType': line.product_id.l10n_eg_item_type,
                'itemCode': line.product_id.l10n_eg_item_code,
                'unitType': line.product_uom_id.l10n_eg_unit_code_id.code,
                'quantity': line.quantity,
                'internalCode': line.product_id.default_code or '',
                'salesTotal': invoice._get_amount_main_currency(
                    line.quantity * line.price_unit
                ),
                'total': invoice._get_amount_main_currency(
                    line.price_total
                ),
                'valueDifference': 0,
                'totalTaxableFees': 0,
                'netTotal': invoice._get_amount_main_currency(
                    line.price_subtotal
                ),
                'itemsDiscount': 0,
                'unitValue': {
                    'currencySold': invoice.currency_id.name,
                    'amountEGP': invoice._get_amount_main_currency(
                        line.price_unit
                    ),
                    'amountSold': 0
                    if line.price_unit
                    == invoice._get_amount_main_currency(line.price_unit)
                    # TODO Maybe make it use orm?
                    else round(line.price_unit, 5),
                },
                'discount': {
                    'rate': line.discount or 0,
                    'amount': discount or 0,
                },
                'taxableItems': [
                    {
                        'taxType': tax.l10n_eg_eta_code.split('_')[0].upper(),
                        'amount': invoice._get_amount_main_currency(
                            abs((tax.amount / 100.0) * line.price_subtotal)
                        )
                        or 0,
                        # show error if its false
                        'subType': tax.l10n_eg_eta_code.split('_')[1].upper(),
                        'rate': invoice._get_amount_main_currency(
                            abs(tax.amount)
                        )
                        or 0,
                    }
                    for tax in line.tax_ids
                ],
            }
            )
            # < if the base currency isn't EGP
            if invoice.currency_id != self.env.ref('base.EGP'):
                lines[-1]['unitValue']['currencyExchangeRate'] = invoice._exchange_currency_rate()
        return lines

    def _l10n_eg_eta_prepare_payment_data(self, invoice):
        if not invoice.partner_bank_id:
            return {
                'bankName': '',
                'bankAddress': '',
                'bankAccountNo': '',
                'bankAccountIBAN': '',
                'swiftCode': '',
                'terms': invoice.invoice_payment_term_id.name or ''
            }
        bank = invoice.partner_bank_id
        return {
            'bankName': bank.bank_id.name,
            'bankAddress': '%s' % bank.bank_id.street,
            # Acc number can be account No or IBAN. TODO: FIX IT
            'bankAccountNo': bank.acc_number,
            'bankAccountIBAN': '',
            'swiftCode': '',
            'terms': invoice.invoice_payment_term_id.name
            if invoice.invoice_payment_term_id
            else '',
        }

    def _l10n_eg_get_partner_tax_info(self, partner_id, issuer=False):
        tax_id = partner_id.vat
        if issuer:
            individaul_type = 'B'
        elif partner_id.commercial_partner_id.country_id == self.env.ref('base.eg'):
            individaul_type = 'B' if partner_id.commercial_partner_id.is_company else 'P'
        else:
            individaul_type = 'F'
        return tax_id, individaul_type

    def _l10n_eg_eta_prepare_address_data(self, partner_id, issuer=False):
        address = {
            'address': {  # TODO: make the eta values come from the commerical partner if it exists.
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
            'name': partner_id.name,
        }
        if issuer:
            address['address']['branchID'] = partner_id.l10n_eg_branch_identifier or ''
        tax_id, individual_type = self._l10n_eg_get_partner_tax_info(
            partner_id, issuer)
        address['type'] = individual_type or ''
        address['id'] = tax_id or ''
        return address

    def _l10n_eg_eta_possible_errors(self):
        return {'T1': {'error': "Please configure the token domain from the system parameters", 'blocking_level': 'error'},
                'T2': {'error': "Please configure the API domain from the system parameters", 'blocking_level': 'error'},
                'T3': {'error': "Please set the branch on the journal", 'blocking_level': 'error'},
                'T4': {'error': "Please add the all the required fields in the branch details", 'blocking_level': 'error'},
                'T5': {'error': "Please add the full the required in the customer/vendor details", 'blocking_level': 'error'},
                'T6': {'error': "Please make sure the invoice is signed", 'blocking_level': 'error'},
                'T7': {'error': "Please make sure the invoice is posted", 'blocking_level': 'error'},
                'T8': {'error': "Please make sure the invoice lines UoM codes are all set up correctly", 'blocking_level': 'error'},
                'T9': {'error': "Please make sure the invoice lines taxes all have the correct ETA tax code", 'blocking_level': 'error'},
                'T10': {'error': "Please make sure the EGS/GS1 is set correctly on all products", 'blocking_level': 'error'},
                }
    # -------------------------------------------------------------------------
    # EDI OVERRIDDEN METHODS
    # -------------------------------------------------------------------------

    def _needs_web_services(self):
        return self.code == 'eg_eta' or super()._needs_web_services()

    def _post_invoice_edi(self, invoices):

        # ---------------------------------------------------------------------

        # OVERRIDE
        if self.code != 'eg_eta':
            return super()._post_invoice_edi(invoices)
        invoice = invoices  # Batching is disabled for this EDI.

        # check for issuer != receiver
        if not self._l10n_eg_get_eta_token_domain():
            return {invoice: self._l10n_eg_eta_possible_errors()['T1']}
        if not self._l10n_eg_get_eta_api_domain():
            return {invoice: self._l10n_eg_eta_possible_errors()['T2']}
        if not invoice.l10n_eg_invoice_signed and self.env.company.l10n_eg_production:
            return {invoice: self._l10n_eg_eta_possible_errors()['T6']}
        if not invoice.l10n_eg_branch_id:
            return {invoice: self._l10n_eg_eta_possible_errors()['T3']}
        if not self._l10n_eg_validate_info_address(invoice.l10n_eg_branch_id, issuer=True):
            return {invoice: self._l10n_eg_eta_possible_errors()['T4']}
        if not self._l10n_eg_validate_info_address(invoice.partner_id):
            return {invoice: self._l10n_eg_eta_possible_errors()['T5']}
        if not invoice.l10n_eg_posted_datetime:
            return {invoice: self._l10n_eg_eta_possible_errors()['T7']}
        if not self._l10n_eg_validate_uom_codes(invoice):
            return {invoice: self._l10n_eg_eta_possible_errors()['T8']}
        if not self._l10n_eg_validate_tax_codes(invoice):
            return {invoice: self._l10n_eg_eta_possible_errors()['T9']}
        if not self._l10n_eg_validate_item_codes(invoice):
            return {invoice: self._l10n_eg_eta_possible_errors()['T10']}

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
        if isinstance(token, dict) and token.get('error', False):
            return {invoice: {
                'error': token.get('error', False),
                'blocking_level': token.get('blocking_level', False)
            }
        }
        request_url = '%s/api/v1.0/documentsubmissions' % api_domain

        request_payload = {
            'documents': [invoice_json]
        }

        data = json.dumps(request_payload, ensure_ascii=False,
                          indent=4).encode('utf-8')

        headers = {'Content-Type': 'application/json',
                   'Authorization': 'Bearer %s' % token}
        try:
            request_response = requests.post(
                request_url, data=data, headers=headers, timeout=(5, 10))
        except Exception as error:
            return {invoice: {'error': str(error), 'blocking_level': 'warning'}}
        if not request_response:
            return {invoice: {
                'error': _('The web service is not responding'),
                'blocking_level': 'warning'
            }}
        if submission_data := request_response.json():
            if submission_data.get('error'):
                return {invoice: {
                    'error': submission_data.get('error'),
                    'blocking_level': 'error'
                }}
            if submission_data.get('rejectedDocuments', False) and isinstance(
                    submission_data.get('rejectedDocuments'), list):
                return {invoice: {
                    'error': str(submission_data.get('rejectedDocuments')[0].get('error')),
                    'blocking_level': 'error'
                }}
            if (
                submission_data.get('submissionId')
                and submission_data.get('submissionId') is not None
                and submission_data.get('acceptedDocuments')
            ):
                return self._extracted_from__l10n_eg_edi_post_invoice_web_service_37(
                    submission_data, invoice
                )

            return {invoice: {
                'success': False,
            }}

    # TODO Rename this here and in `_l10n_eg_edi_post_invoice_web_service`
    def _extracted_from__l10n_eg_edi_post_invoice_web_service_37(self, submission_data, invoice):
        invoice.l10n_eg_submission_id = submission_data.get('submissionId')
        uuid = submission_data.get('acceptedDocuments')[0].get('uuid')
        invoice.l10n_eg_uuid = uuid
        invoice.l10n_eg_long_id = submission_data.get(
            'acceptedDocuments')[0].get('longId')
        invoice.l10n_eg_internal_id = submission_data.get('acceptedDocuments')[
            0].get('internalId')
        invoice.l10n_eg_hash_key = submission_data.get('acceptedDocuments')[
            0].get('hashKey')
        return {invoice: {
            'l10n_eg_uuid': uuid,
            'success': True
        }}

    def _cancel_invoice_edi(self, invoices):
        # OVERRIDE
        if self.code != 'eg_eta':
            return super()._cancel_invoice_edi(invoices)
        invoice = invoices
        api_domain = self._l10n_eg_get_eta_api_domain()
        token = self._l10n_eg_get_einvoice_token(invoice)
        if isinstance(token, dict) and token.get('error', False):
            return {invoice: {
                'error': token.get('error', False),
                'blocking_level': token.get('blocking_level', False)
            }
        }
        request_url = '%s/api/v1/documents/state/%s/state' % (
            api_domain, invoice.l10n_eg_uuid)
        request_payload = {
            'status': 'cancelled',
            'reason': 'Cancelled'
        }
        data = json.dumps(request_payload)
        headers = {'Content-Type': 'application/json',
                   'Authorization': 'Bearer %s' % token}
        request_response = requests.request(
            'PUT', request_url, headers=headers, data=data, timeout=(5, 10))
        if request_response.status_code not in [500, 400, 200]:
            return {invoice: {
                'error': request_response.text,
                'blocking_level': 'warning'
            }}
        get_invoice_data = request_response.json()

        if get_invoice_data.get('error'):
            error_details = get_invoice_data.get('error').get('details')
            error_message = "\n".join(error.get('message') for error in error_details)
            return {invoice: {
                'error': error_message,
                'blocking_level': 'error'
            }}

        return {invoice: {
            'success': True,
            'data': get_invoice_data
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
