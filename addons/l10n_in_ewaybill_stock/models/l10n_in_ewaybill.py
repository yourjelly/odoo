# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import json
import re
import markupsafe
import logging

from odoo import fields, models, api, _
from odoo.exceptions import UserError, AccessError, ValidationError
from odoo.tools import html_escape, html2plaintext

from odoo.addons.iap import jsonrpc
from odoo.addons.l10n_in_edi.models.account_edi_format import DEFAULT_IAP_ENDPOINT, DEFAULT_IAP_TEST_ENDPOINT
from odoo.addons.l10n_in_edi_ewaybill.models.error_codes import ERROR_CODES

from datetime import timedelta
from markupsafe import Markup
from psycopg2 import OperationalError


_logger = logging.getLogger(__name__)


class Ewaybill(models.Model):
    _inherit = "l10n.in.ewaybill"
    _description = "Ewaybill for stock movement"

    stock_picking_id = fields.Many2one("stock.picking", "Stock Transfer")
    move_ids = fields.One2many('stock.move', related="stock_picking_id.move_ids", readonly=False)
    picking_type_code = fields.Selection(
        related='stock_picking_id.picking_type_id.code',
        readonly=True)

    # Fields for ewaybill amount calculation
    amount_untaxed = fields.Monetary(string="Untaxed Amount", store=True, compute='_compute_amounts', tracking=True)
    amount_total = fields.Monetary(string="Total", store=True, compute='_compute_amounts', tracking=True)
    tax_totals = fields.Binary(compute='_compute_tax_totals')

    currency_id = fields.Many2one(
        'res.currency',
        string='Currency',
        tracking=True,
        compute='_compute_currency_id', store=True)

    @api.depends('move_ids')
    def _compute_amounts(self):
        for record in self:
            amount_untaxed = 0
            amount_total = 0
            for rec in record.move_ids:
                amount_untaxed += rec.ewaybill_price_subtotal
                amount_total += rec.ewaybill_price_total
            record.amount_untaxed = amount_untaxed
            record.amount_total = amount_total

    @api.depends('move_ids.ewaybill_tax_ids', 'move_ids.price_unit', 'amount_total', 'amount_untaxed', 'currency_id')
    def _compute_tax_totals(self):
        for record in self:
            lines = record.move_ids
            record.tax_totals = self.env['account.tax']._prepare_tax_totals(
                [x._convert_to_tax_base_line_dict() for x in lines],
                record.currency_id or record.company_id.currency_id,
            )

    def _compute_currency_id(self):
        for record in self:
            record.currency_id = record.stock_picking_id.company_id.currency_id

    def _compute_supply_type(self):
        for ewaybill in self:
            if ewaybill.account_move_id:
                return super()._compute_supply_type()
            if ewaybill.stock_picking_id.picking_type_id.code == 'incoming':
                ewaybill.supply_type = 'I'
            else:
                ewaybill.supply_type = 'O'

    def _compute_document_details(self):
        for ewaybill in self:
            if ewaybill.account_move_id:
                return super()._compute_document_details()
            ewaybill.company_id = False
            ewaybill.document_date = False
            ewaybill.is_overseas = False
            stock_picking_id = ewaybill.stock_picking_id
            ewaybill.document_number = stock_picking_id.name
            ewaybill.company_id = stock_picking_id.company_id.id
            ewaybill.document_date = stock_picking_id.date_done
            if ewaybill.partner_bill_to_id.l10n_in_gst_treatment in ('overseas', 'special_economic_zone'):
                ewaybill.is_overseas = True

    def _compute_document_partners_details(self):
        for ewaybill in self:
            if ewaybill.account_move_id:
                return super()._compute_document_partners_details()
            ewaybill.partner_bill_to_id = False
            ewaybill.partner_bill_from_id = False
            ewaybill.partner_ship_to_id = False
            ewaybill.partner_ship_from_id = False
            stock_picking_id = ewaybill.stock_picking_id
            if stock_picking_id:
                if stock_picking_id.picking_type_id.code == 'incoming':
                    ewaybill.partner_bill_to_id = stock_picking_id.company_id.partner_id
                    ewaybill.partner_bill_from_id = stock_picking_id.partner_id
                    ewaybill.partner_ship_to_id = stock_picking_id.company_id.partner_id
                    ewaybill.partner_ship_from_id = stock_picking_id.partner_id
                else:
                    ewaybill.partner_bill_to_id = stock_picking_id.partner_id
                    ewaybill.partner_bill_from_id = stock_picking_id.company_id.partner_id
                    ewaybill.partner_ship_to_id = stock_picking_id.partner_id
                    ewaybill.partner_ship_from_id = stock_picking_id.company_id.partner_id

    def _l10n_in_prepare_edi_tax_details(self):
        for ewaybill in self:
            if ewaybill.account_move_id:
                return super()._l10n_in_prepare_edi_tax_details()
            tax_details = []
            for line in ewaybill.stock_picking_id.move_lines:
                if line.product_id.type == 'service':
                    continue
                tax_details.append({
                    'taxable_value': line.product_uom_qty * line.price_unit,
                    'tax_amount': line._l10n_in_get_edi_tax_amount(),
                    'tax_rate': line._l10n_in_get_edi_tax_rate(),
                    'tax_type': line._l10n_in_get_edi_tax_type(),
                    'cess_amount': line._l10n_in_get_edi_cess_amount(),
                    'cess_non_advol_amount': line._l10n_in_get_edi_cess_non_advol_amount(),
                    'tax_invoice_number': line._l10n_in_get_edi_tax_invoice_number(),
                    'tax_invoice_date': line._l10n_in_get_edi_tax_invoice_date(),
                    'hsn_code': line.product_id.l10n_in_hsn_code,
                    'tax_electronic_reference': line._l10n_in_get_edi_tax_electronic_reference(),
                })
            return tax_details

    def _l10n_in_tax_details_by_line(self, move):
        taxes = move.ewaybill_tax_ids.compute_all(price_unit=move.price_unit, quantity=move.quantity_done)
        igst_rate = 0.0
        igst_amount = 0.0
        cgst_rate = 0.0
        cgst_amount = 0.0
        sgst_rate = 0.0
        sgst_amount = 0.0
        cess_rate = 0.0
        cess_amount = 0.0
        cess_non_advol_rate = 0.0
        cess_non_advol_amount = 0.0
        other_amount = 0.0

        for tax in taxes['taxes']:
            tax_id = self.env['account.tax'].browse(tax['id'])

            if self.env.ref("l10n_in.tax_tag_igst").id in tax['tag_ids']:
                igst_rate += tax_id.amount
                igst_amount += tax['amount']

            elif self.env.ref("l10n_in.tax_tag_cgst").id in tax['tag_ids']:
                cgst_rate += tax_id.amount
                cgst_amount += tax['amount']

            elif self.env.ref("l10n_in.tax_tag_sgst").id in tax['tag_ids']:
                sgst_rate += tax_id.amount
                sgst_amount += tax['amount']

            elif self.env.ref("l10n_in.tax_tag_cess").id in tax['tag_ids']:
                if tax_id.amount_type != "percent":
                    cess_non_advol_rate += tax_id.amount
                    cess_non_advol_amount += tax['amount']
                else:
                    cess_rate += tax_id.amount
                    cess_amount += tax['amount']
            else:
                other_amount += tax['amount']

        tax_vals = {
            "igst_rate": igst_rate,
            "igst_amount": igst_amount,
            "cgst_rate": cgst_rate,
            "cgst_amount": cgst_amount,
            "sgst_rate": sgst_rate,
            "sgst_amount": sgst_amount,
            "cess_non_advol_rate": cess_non_advol_rate,
            "cess_non_advol_amount": cess_non_advol_amount,
            "cess_rate": cess_rate,
            "cess_amount": cess_amount,
            "other_amount": other_amount,
        }
        return tax_vals

    def _get_l10n_in_ewaybill_line_details(self, line):
        AccountEdiFormat = self.env['account.edi.format']
        round_value = AccountEdiFormat._l10n_in_round_value
        extract_digits = self._l10n_in_edi_extract_digits
        tax_details_by_line = self._l10n_in_tax_details_by_line(line)
        line_details = {
            "productName": line.product_id.name,
            "hsnCode": extract_digits(line.product_id.l10n_in_hsn_code),
            "productDesc": line.product_id.name,
            "quantity": line.quantity_done,
            "qtyUnit": line.product_id.uom_id.l10n_in_code and line.product_id.uom_id.l10n_in_code.split("-")[
                0] or "OTH",
            "taxableAmount": round(line.price_unit),
        }
        if tax_details_by_line.get('igst_rate'):
            line_details.update({"igstRate": round(tax_details_by_line.get("igst_rate"), 2)})
        else:
            line_details.update({
                "cgstRate": round(tax_details_by_line.get("cgst_rate"), 2),
                "sgstRate": round(tax_details_by_line.get("sgst_rate"), 2),
            })
        if tax_details_by_line.get("cess_rate"):
            line_details.update({"cessRate": round(tax_details_by_line.get("cess_rate", 2))})
        return line_details

    @api.model
    def _l10n_in_tax_details(self, ewaybill):
        total_taxes = {
            "igst_rate": 0.0,
            "igst_amount": 0.0,
            "cgst_rate": 0.0,
            "cgst_amount": 0.0,
            "sgst_rate": 0.0,
            "sgst_amount": 0.0,
            "cess_non_advol_rate": 0.0,
            "cess_non_advol_amount": 0.0,
            "cess_rate": 0.0,
            "cess_amount": 0.0,
            "other_amount": 0.0,
        }
        for move in ewaybill.move_ids:
            line_tax_vals = self._l10n_in_tax_details_by_line(move)

            total_taxes['igst_rate'] += line_tax_vals['igst_rate']
            total_taxes['igst_amount'] += line_tax_vals['igst_amount']
            total_taxes['cgst_rate'] += line_tax_vals['cgst_rate']
            total_taxes['cgst_amount'] += line_tax_vals['cgst_amount']
            total_taxes['sgst_rate'] += line_tax_vals['sgst_rate']
            total_taxes['sgst_amount'] += line_tax_vals['sgst_amount']
            total_taxes['cess_non_advol_rate'] += line_tax_vals['cess_non_advol_rate']
            total_taxes['cess_non_advol_amount'] += line_tax_vals['cess_non_advol_amount']
            total_taxes['cess_rate'] += line_tax_vals['cess_rate']
            total_taxes['cess_amount'] += line_tax_vals['cess_amount']
            total_taxes['other_amount'] += line_tax_vals['other_amount']

        return total_taxes

    def _ewaybill_generate_direct_json(self):
        for ewaybill in self:
            print("-----------", ewaybill.stock_picking_id)
            json_payload = super()._ewaybill_generate_direct_json()
            if ewaybill.stock_picking_id:
                AccountEdiFormat = self.env['account.edi.format']
                round_value = AccountEdiFormat._l10n_in_round_value
                tax_details = self._l10n_in_tax_details(ewaybill)
                json_payload.update({
                    "itemList": [
                        self._get_l10n_in_ewaybill_line_details(line)
                        for line in ewaybill.move_ids
                    ],
                    "totalValue": round(ewaybill.amount_untaxed, 2),
                    "cgstValue": round(tax_details.get('cgst_amount'), 2),
                    "sgstValue": round(tax_details.get('sgst_amount'), 2),
                    "igstValue": round(tax_details.get('igst_amount'), 2),
                    "cessValue": round(tax_details.get('cess_amount'), 2),
                    "cessNonAdvolValue": round(tax_details.get('cess_non_advol_amount'), 2),
                    "otherValue": round(tax_details.get('other_amount'), 2),
                    "totInvValue": round(ewaybill.amount_total, 2),
                })
            print(json_payload)
            return json_payload
