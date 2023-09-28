# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
import json
import re
import requests
from datetime import datetime

from odoo import api, Command, fields, models, _
from odoo.exceptions import UserError, ValidationError
from odoo.addons.base.models.ir_qweb_fields import Markup, nl2br, nl2br_enclose

from ..utils import check_required_fields

_logger = logging.getLogger(__name__)

URL = "https://etims-api-sbx.kra.go.ke/etims-api/"
RECEIPT_URL = "https://etims-sbx.kra.go.ke/common/link/etims/receipt/indexEtimsReceiptData?Data=%s"
SALE_URL = URL + "saveTrnsSalesOsdc"
PURCHASE_URL = URL + "insertTrnsPurchase"
FETCH_URL = URL + "selectTrnsPurchaseSalesList"

class AccountMove(models.Model):
    _inherit = 'account.move'

    l10n_ke_oscu_confirmation_datetime = fields.Datetime(copy=False)
    l10n_ke_oscu_receipt_number = fields.Integer(string="Receipt Number", copy=False)
    l10n_ke_oscu_invoice_number = fields.Integer(string="Invoice Number", copy=False)
    l10n_ke_oscu_signature = fields.Char(string="Signature", copy=False)
    l10n_ke_oscu_datetime = fields.Datetime(string="Signing Time", copy=False)
    l10n_ke_oscu_internal_data = fields.Char(string="Internal Data", copy=False)
    l10n_ke_oscu_receipt_url = fields.Char(string="ETIMS Receipt URL", compute='_compute_l10n_ke_oscu_receipt_url')
    l10n_ke_oscu_serial_number = fields.Char(string="OSCU Serial Number")
    l10n_ke_oscu_branch_code = fields.Char(string="OSCU Branch ID")
    l10n_ke_oscu_attachment_file = fields.Binary(copy=False, attachment=True)
    l10n_ke_oscu_attachment_id = fields.Many2one(
        comodel_name='ir.attachment',
        string="FatturaPA Attachment",
        compute=lambda self: self._compute_linked_attachment_id('l10n_ke_oscu_attachment_id', 'l10n_ke_oscu_attachment_file'),
        depends=['l10n_ke_oscu_attachment_file'],
    )

    def _post(self, soft=True):
        self.l10n_ke_oscu_confirmation_datetime = fields.Datetime.now()
        return super()._post(soft)

    # def _l10n_ke_oscu_get_payment_type(self):
    # """
    #     'pmtTyCd': '01', # Payment type, cash, credit cash/credit bank check debit & credit card mobile money other (not required)
    #      01 1 CASH CASH
    #      02 2 CREDIT CREDIT
    #      03 3 CASH/CREDIT CASH/CREDIT
    #      04 4 BANK CHECK BANK CHECK PAYMENT
    #      05 5 DEBIT&CREDIT CARD PAYMENT USING CARD
    #      06 6 MOBILE MONEY ANY TRANSACTION USING MOBILE MONEY SYSTEM
    #      07 7 OTHER OTHER MEANS OF PAYMENT
    # """

    #     pass

    @api.depends('company_id.vat', 'l10n_ke_oscu_branch_code', 'l10n_ke_oscu_signature')
    def _compute_l10n_ke_oscu_receipt_url(self):
        for move in self:
            move.l10n_ke_oscu_receipt_url = RECEIPT_URL % ''.join([
                move.company_id.vat,
                move.l10n_ke_oscu_branch_code,
                move.l10n_ke_oscu_signature,
            ])

    def _l10n_ke_oscu_move_content(self):
        self.ensure_one()

        confirmation_date = self.l10n_ke_oscu_confirmation_datetime and self.l10n_ke_oscu_confirmation_datetime.strftime('%Y%m%d%H%M%S')
        invoice_date = self.invoice_date and self.invoice_date.strftime('%Y%m%d')
        original_invoice_number = self.reversed_entry_id and self.reversed_entry_id.l10n_ke_oscu_invoice_number or 0
        tax_details = self._prepare_invoice_aggregated_taxes()
        line_items = self.invoice_line_ids._l10n_ke_oscu_get_items(tax_details)

        taxable_amounts = {
            f'taxblAmt{letter}': sum(
                [item['taxblAmt'] for item in line_items.values() if item['taxTyCd'] == letter]
            ) for letter in ['A', 'B', 'C', 'D', 'E']
        }
        tax_amounts = {
            f'taxAmt{letter}': sum(
                [item['taxAmt'] for item in line_items.values() if item['taxTyCd'] == letter]
            ) for letter in ['A', 'B', 'C', 'D', 'E']
        }

        content = {
            'invcNo':           '',                                      # KRA Invoice Number (set at the point of sending)
            'trdInvcNo':        self.name,                               # Trader system invoice number
            'orgInvcNo':        original_invoice_number,                 # Original invoice number
            'cfmDt':            confirmation_date,                       # Validated date
            # 'pmtTyCd': self._l10n_ke_oscu_get_payment_type()           # TODO Payment type code (not required)
            'rcptTyCd': {                                                # Receipt code
                'out_invoice':  'S',                                     # - Sale
                'out_refund':   'R',                                     # - Credit note after sale
                'in_invoice':   'P',                                     # - Purchase
                'in_refund':    'R',                                     # - Credit note after purchase
            }[self.move_type],
            **taxable_amounts,
            **tax_amounts,
            'taxRtA':           0,                                       # TODO these are variable
            'taxRtB':           16,
            'taxRtC':           0,
            'taxRtD':           0,
            'taxRtE':           8,
            'totTaxblAmt':      tax_details['base_amount'],
            'totTaxAmt':        tax_details['tax_amount'],
            'totAmt':           self.amount_total,
            'totItemCnt':       len(line_items),                         # Total Item count
            'regrId':           self.user_id.id or self.env.user.id,     # TODO Registration ID
            'regrNm':           self.user_id.name or self.env.user.name, # TODO Registration Name
            'modrId':           self.user_id.id or self.env.user.id,     # TODO Modifier ID
            'modrNm':           self.user_id.name or self.env.user.name, # TODO Modifier name
            'itemList':         list(line_items.values()),
        }

        if self.move_type in ('in_invoice', 'in_refund'):
            content.update({
                'spplrTin':     self.partner_id.vat,                     # Supplier VAT
                'spplrNm':      self.partner_id.name,                    # Supplier name
                'regTyCd':      'M',                                     # Registration type code (Manual / Automatic)
                'pchsTyCd':     'N',                                     # Purchase type code (Copy / Normal / Proforma)
                'pmtTyCd':      '01',
                'pchsSttsCd':   '02',                                    # Transaction status code TODO (02 approved / 05 credit note generated)
                'pchsDt':       invoice_date,                            # Purchase date
                # "spplrInvcNo": None,
            })
            missing_fields = check_required_fields('TrnsPurchaseSaveReq', content)
        else:
            receipt_part = {
                'custTin':      self.partner_id.vat,                     # Partner VAT
                'rcptPbctDt':   confirmation_date,                       # Receipt published date
                'prchrAcptcYn': 'N',                                     # Purchase accepted Yes/No
            }
            if self.partner_id.mobile:
                receipt_part.update({
                    'custMblNo': self.partner_id.mobile                  # Mobile number, not required
                })
            if self.partner_id.contact_address_inline:
                receipt_part.update({
                    'adrs': self.partner_id.contact_address_inline,      # Address, not required
                })
            content.update({
                'custTin':      self.partner_id.vat,                     # Partner VAT
                'custNm':       self.partner_id.name,                    # Partner name
                'salesSttsCd':  '02',                                    # Transaction status code TODO
                'salesDt':      invoice_date,                            # Sales date
                'prchrAcptcYn': 'N',
                'receipt':      receipt_part,
            })
            missing_fields = check_required_fields('TrnsSalesSaveWrReq', content)
        if missing_fields:
            raise ValidationError(_("Required field %s missing from invoice content.", missing_fields))
        return content

    def action_l10n_ke_oscu_send(self):
        for move in self:
            company = move.company_id
            sequence = company.l10n_ke_oscu_seq_invoice_id if move.move_type in ('out_invoice', 'out_refund') else company.l10n_ke_oscu_seq_vendor_bill_id
            content = self._l10n_ke_oscu_move_content()
            content.update({'invcNo': sequence.number_next})            # KRA Invoice Number
            session = company.l10n_ke_oscu_get_session()
            url_to_use = SALE_URL if move.move_type in ('out_invoice', 'out_refund') else PURCHASE_URL
            response = session.post(url_to_use, json=content)
            # if not response.ok:
            #     raise somekindofError()
            if response.json()['resultCd'] == '000':
                response_data = response.json()['data']
                move.update({
                    'l10n_ke_oscu_receipt_number': response_data['curRcptNo'],
                    'l10n_ke_oscu_invoice_number': content['invcNo'],
                    'l10n_ke_oscu_signature': response_data['rcptSign'],
                    'l10n_ke_oscu_datetime': datetime.strptime(response_data['sdcDateTime'], '%Y%m%d%H%M%S'),
                    'l10n_ke_oscu_internal_data': response_data['intrlData'],
                    'l10n_ke_oscu_serial_number': company.l10n_ke_oscu_serial_number,
                    'l10n_ke_oscu_branch_code': company.l10n_ke_oscu_branch_code,
                })
                sequence.next_by_id()

    def cron_l10n_ke_oscu_fetch_purchases(self):
        """  """
        companies = self.env['res.company'].search([
            ('l10n_ke_oscu_branch_code', '!=', False),
            ('l10n_ke_oscu_serial_number', '!=', False),
            ('l10n_ke_oscu_cmc_key', '!=', False),
        ])
        moves = self
        for company in companies:
            session = company.l10n_ke_oscu_get_session()
            response = session.post(FETCH_URL, json={'lastReqDt': company.l10n_ke_oscu_last_fetch_purchase_date})
            response_content = response.json()
            if response_content['resultCd'] == '001':
                _logger.warning('There are no new vendor bills on the OSCU for %s.', company.name)
                continue
            if response_content['resultCd'] != '000':
                _logger.error(
                    'Error retrieving purchases from the OSCU: %s: %s',
                    response_content['resultCd'], response_content['resultMsg']
                )

            for purchase in response_content['data']['saleList']:
                filename = f"{purchase['spplrSdcId']}_{purchase['spplrInvcNo']}.json"
                existing = self.env['ir.attachment'].search([
                    ('name', '=', filename),
                    ('res_model', '=', 'account.move'),
                    ('res_field', '=', 'l10n_ke_oscu_attachment_file'),
                ])
                if existing:
                    _logger.warning('Vendor bill already exists: %s', filename)
                    continue

                move = self.with_company(company).create({})
                attachment = self.env['ir.attachment'].create({
                    'name': filename,
                    'raw': json.dumps(purchase).encode(),
                    'type': 'binary',
                    'res_model': 'account.move',
                    'res_id': move.id,
                    'res_field': 'l10n_ke_oscu_attachment_file',
                })
                move.with_context(
                    account_predictive_bills_disable_prediction=True,
                    no_new_invoice=True,
                ).message_post(attachment_ids=attachment.ids)
                moves |= move

        for move in moves:
            move._extend_with_attachments(move.l10n_ke_oscu_attachment_id, new=True)
            self.env.cr.commit()


    def _get_edi_decoder(self, file_data, new=False):
        # EXTENDS 'account'
        if file_data['type'] == 'binary':
            try:
                content = json.loads(file_data['content'])
                if all(key in content for key in (
                    'spplrTin', 'spplrNm', 'spplrBhfId', 'spplrInvcNo'
                )):
                    return self._l10n_ke_oscu_import_invoice
            except Exception:
                pass
        return super()._get_edi_decoder(file_data, new=new)

    def _l10n_ke_oscu_import_invoice(self, invoice, data, is_new):
        """ Decodes the json content from eTIMS into an Odoo move.

        :param data:   the dictionary with the content to be imported
        :param is_new: whether the move is newly created or to be updated
        :returns:      the imported move
        """
        company = self.company_id
        content = json.loads(data['content'])
        message_to_log = []

        self.move_type = {
            'S': 'in_invoice',
            'R': 'in_refund',
        }.get(content['rcptTyCd'], 'in_invoice')

        self.partner_id = self.env['res.partner'].search([('vat', 'ilike', content['spplrTin'])], limit=1)
        if not self.partner_id:
            message = Markup("<br/>").join((
                _("Vendor not found. Please create or update a vendor with the corresponding details:"),
                _("Name: %s", content['spplrNm']),
                _("Tax ID: %s", content['spplrTin']),
            ))
            message_to_log.append(message)

            self.l10n_ke_oscu_branch_code = content['spplrBhfId']
            self.l10n_ke_oscu_invoice_number = content['spplrInvcNo']
            self.l10n_ke_oscu_confirmation_datetime = datetime.strptime(content['cfmDt'], '%Y-%m-%d %H:%M:%S')
            self.invoice_date = datetime.strptime(content['salesDt'], '%Y%m%d').date()
            self.l10n_ke_oscu_serial_number = content['spplrSdcId']
            # TODO default account

            lines_dict = self.env['product.product']._l10n_ke_assign_products_from_json(
                {item['itemSeq']: item for item in content['itemList']}
            )
            self.invoice_line_ids = [Command.create({
                'product_id': item['product'].id,
                'sequence':   sequence * 10,
                'name':       item['itemNm'],
                'quantity':   item['qty'],
                'price_unit': item['prc'],
                'discount':   item['dcRt'],
            }) for sequence, item in lines_dict.items()]

            message_to_log += [item['message'] for item in lines_dict.values() if item.get('message')]

            for message in message_to_log:
                self.sudo().message_post(body=message)



            # for item_created in self.env['product.product']._l10n_ke_oscu_create_vals_from_json(to_create)

            # for item in content['itemList']:

            #     if not (product or matching_message):
                    # product_create_val = self.env['product.product']._l10n_ke_oscu_create_vals_from_json(items):


                # message = Markup("<br/>").join((
                # _("A product matching this item could not be found. Please create or update a product with the corresponding details:"),
                # _("Name: %s", item['itemNm']),
                # _("Item Code: %s", item['itemCd']),
                # _("UNSPSC Code: %s", item['itemClsCd']),
                # _("Packging Unit %s", item[''])
                # ('l10n_ke_packaging_unit_id.code', '=', item['pkgUnitCd']),
                # ('l10n_ke_quantity_unit_id.code', '=', item['qtyUnitCd']),
                # ('l10n_ke_product_type_code', '=', item['itemTyCd']),
                # ('l10n_ke_origin_country_id.code', '=', item['orgnNatCd'])
                # ))


   # 'itemList': [{'itemSeq': 1,
   #   'bcd': None,
   #   'pkgUnitCd': 'CTN',
   #   'pkg': 0,
   #   'qtyUnitCd': 'KG',
   #   'qty': 20,
   #   'prc': 200,
   #   'splyAmt': 4000,
   #   'dcRt': 0,
   #   'dcAmt': 0,
   #   'taxTyCd': 'C',
   #   'taxblAmt': 4000,
   #   'taxAmt': 0,
   #   'totAmt': 4000},

    # def _l10n_ke_oscu_import_invoice_items(self, invoice, data, is_new):
