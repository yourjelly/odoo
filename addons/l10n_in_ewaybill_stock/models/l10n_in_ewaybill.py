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

    amount_untaxed = fields.Monetary(string="Untaxed Amount", store=True, compute='_compute_amounts', tracking=True)
    amount_total = fields.Monetary(string="Total", store=True, compute='_compute_amounts', tracking=True)
    tax_totals = fields.Binary(compute='_compute_tax_totals')

    gst_treatment = fields.Selection([
            ('regular', 'Registered Business - Regular'),
            ('composition', 'Registered Business - Composition'),
            ('unregistered', 'Unregistered Business'),
            ('consumer', 'Consumer'),
            ('overseas', 'Overseas'),
            ('special_economic_zone', 'Special Economic Zone'),
            ('deemed_export', 'Deemed Export'),
            ('uin_holders', 'UIN Holders'),
        ], string="GST Treatment", compute="_compute_gst_treatment", store=True, readonly=False, copy=True)


    sub_type_code = fields.Char(related="type_id.sub_type_code")
    type_desc = fields.Char("Type Description")

    picking_type_code = fields.Selection(
        related='stock_picking_id.picking_type_id.code',
        readonly=True)

    ewaybill_number = fields.Char("Ewaybill Number", compute="_compute_ewaybill_number", store=True)
    cancel_reason = fields.Selection(selection=[
        ("1", "Duplicate"),
        ("2", "Data Entry Mistake"),
        ("3", "Order Cancelled"),
        ("4", "Others"),
        ], string="Cancel reason", copy=False, tracking=True)
    cancel_remarks = fields.Char("Cancel remarks", copy=False, tracking=True)

    currency_id = fields.Many2one(
        'res.currency',
        string='Currency',
        tracking=True,
        compute='_compute_currency_id', store=True)

    def action_download_json(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_url',
            'url': '/l10n_in_ewaybill/ewaybill_json/%s' % self.id,
        }

    @api.depends('state')
    def _compute_display_name(self):
        for ewaybill in self:
            if ewaybill.ewaybill_number:
                ewaybill.display_name = ewaybill.ewaybill_number
            else:
                ewaybill.display_name = "Draft"

    @api.depends('attachment_id')
    def _compute_ewaybill_number(self):
        for ewaybill in self:
            ewaybill_response_json = ewaybill._get_l10n_in_edi_ewaybill_response_json()
            if ewaybill_response_json:
                ewaybill.ewaybill_number = ewaybill_response_json.get("ewayBillNo") or ewaybill_response_json.get("EwbNo")
            else:
                ewaybill.ewaybill_number = False

    def _compute_date(self):
        for record in self:
            if record.account_move_id:
                return super()._compute_date()  
            record.date = record.stock_picking_id.scheduled_date

    def _compute_company_id(self):
        for record in self:
            if record.account_move_id:
                return super()._compute_company_id()  
            record.company_id = record.stock_picking_id.company_id

    def _compute_currency_id(self):
        for record in self:
            record.currency_id = record.stock_picking_id.company_id.currency_id

    def _compute_partner_id(self):
        for record in self:
            if record.account_move_id:
                return super()._compute_partner_id()  
            record.partner_id = record.stock_picking_id.partner_id

    @api.depends('partner_id')
    def _compute_partner_shipping_id(self):
        for ewaybill in self:
            if ewaybill.account_move_id:
                return super()._compute_partner_shipping_id()  
            ewaybill.partner_shipping_id = ewaybill.stock_picking_id.partner_id


    @api.depends('stock_picking_id')
    def _compute_state_id(self):
        for ewaybill in self:
            if ewaybill.account_move_id:
                return super()._compute_state_id()  
            ewaybill.state_id = ewaybill.partner_id.state_id

    
    @api.depends('partner_id')
    def _compute_gst_treatment(self):
        for record in self:
            gst_treatment = record.partner_id.l10n_in_gst_treatment
            if not gst_treatment:
                gst_treatment = 'unregistered'
                if record.partner_id.country_id.code == 'IN' and record.partner_id.vat:
                    gst_treatment = 'regular'
                elif record.partner_id.country_id and record.partner_id.country_id.code != 'IN':
                    gst_treatment = 'overseas'
            record.gst_treatment = gst_treatment

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

    def ewaybill_cancel(self):
        for ewaybill in self:
            if ewaybill.state == "sent" and (not ewaybill.cancel_reason or not ewaybill.cancel_remarks):
                raise UserError(_("To cancel E-waybill set cancel reason and remarks\n"))
            res = ewaybill._l10n_in_ewaybill_cancel_invoice(ewaybill)
            if res.get(ewaybill).get("success") is True:
                ewaybill.message_post(body=_("A cancellation of the Ewaybill has been requested."))
                ewaybill.write({'state': 'cancel'})
            else:
                raise ValidationError(_("\nEwaybill not cancelled \n\n%s") % (html2plaintext(res.get(ewaybill).get("error", False))))

    def ewaybill_draft_send(self):
        for ewaybill in self:
            errors = self._check_ewaybill_configuration(ewaybill)
            if errors:
                raise UserError(_("Invalid invoice configuration:\n%s") % '\n'.join(errors))

            res = ewaybill._l10n_in_ewaybill_post_invoice_edi(ewaybill)
            if res.get(ewaybill).get("success") is True:
                ewaybill.write({
                    'state': 'sent',
                    'attachment_id' : res.get(ewaybill).get('attachment'),
                })
                stock_picking = self.env['stock.picking'].browse(ewaybill.stock_picking_id.id)
                stock_picking.write({'ewaybill_id': self.id})
            else:
                ewaybill.write({
                    'state': 'error',
                })
                ewaybill.error_message = res.get(ewaybill).get("error", False)

    def ewaybill_send(self):
        for ewaybill in self:
            if ewaybill.account_move_id:
                return super(Ewaybill, self).ewaybill_send()
            ewaybill.state = "sending"
            self._send_draft_ewaybill(with_commit=True)

    @api.model
    def _send_draft_ewaybill(self, job_count=10, with_commit=True):
        ewaybills_to_process = self.env['l10n.in.ewaybill'].search([
            ('state', '=', 'sending'),
        ], limit=job_count)

        for ewaybill in ewaybills_to_process:
            try:
                with self.env.cr.savepoint():
                    self._cr.execute('SELECT * FROM l10n_in_ewaybill WHERE id IN %s FOR UPDATE NOWAIT', [tuple(ewaybills_to_process.ids)])
            except OperationalError as e:
                if e.pgcode == '55P03':
                    _logger.debug('Another transaction already locked documents rows. Cannot process documents.')
                    if not with_commit:
                        raise UserError(_('This document is being sent by another process already.'))
                    continue
                else:
                    raise e
            ewaybill.ewaybill_draft_send()
            if with_commit and len(ewaybills_to_process) > 1:
                self.env.cr.commit()

        if len(ewaybills_to_process) > job_count:
            self.env.ref('l10n_in_ewaybill.ir_cron_send_draft_ewaybill')._trigger()

    def ewaybill_update_part_b(self):
        return {
            'name': _('Update Part-B'),
            'res_model': 'ewaybill.update.part.b',
            'view_mode': 'form',
            'context': {
                'default_ewaybill_id': self.id,
            },
            'target': 'new',
            'type': 'ir.actions.act_window',
        }

    def ewaybill_update_transporter(self):
        return {
            'name': _('Update Transporter'),
            'res_model': 'ewaybill.update.transporter',
            'view_mode': 'form',
            'context': {
                'default_ewaybill_id': self.id,
            },
            'target': 'new',
            'type': 'ir.actions.act_window',
        }

    def ewaybill_extend_validity(self):
        return {
            'name': _('Extend Validity'),
            'res_model': 'ewaybill.extend.validity',
            'view_mode': 'form',
            'context': {
                'default_ewaybill_id': self.id,
            },
            'target': 'new',
            'type': 'ir.actions.act_window',
        }

    def _l10n_in_ewaybill_post_invoice_edi(self, ewaybill):
        response = {}
        res = {}
        generate_json = self._l10n_in_ewaybill_generate_json(ewaybill)
        response = self._l10n_in_edi_ewaybill_generate(ewaybill.company_id, generate_json)
        if response.get("error"):
            error = response["error"]
            error_codes = [e.get("code") for e in error]
            if "238" in error_codes:
                # Invalid token eror then create new token and send generate request again.
                # This happen when authenticate called from another odoo instance with same credentials (like. Demo/Test)
                authenticate_response = self._l10n_in_edi_ewaybill_authenticate(ewaybill.company_id)
                if not authenticate_response.get("error"):
                    error = []
                    response = self._l10n_in_edi_ewaybill_generate(ewaybill.company_id, generate_json)
                    if response.get("error"):
                        error = response["error"]
                        error_codes = [e.get("code") for e in error]
            if "604" in error_codes:
                # Get E-waybill by details in case of E-waybill is already generated
                # this happens when timeout from the Government portal but E-waybill is generated
                response = self._l10n_in_edi_ewaybill_get_by_consigner(
                    ewaybill.company_id, generate_json.get("docType"), generate_json.get("docNo"))
                if not response.get("error"):
                    error = []
                    odoobot = self.env.ref("base.partner_root")
                    ewaybill.message_post(author_id=odoobot.id, body=
                        _("Somehow this E-waybill has been generated in the government portal before. You can verify by checking the invoice details into the government (https://ewaybillgst.gov.in/Others/EBPrintnew.asp)")
                    )
            if "no-credit" in error_codes:
                res[ewaybill] = {
                    "success": False,
                    "error": self._l10n_in_edi_get_iap_buy_credits_message(ewaybill.company_id),
                    "blocking_level": "error",
                }
            elif error:
                error_message = "<br/>".join(["[%s] %s" % (e.get("code"), html_escape(e.get("message") or self._l10n_in_edi_ewaybill_get_error_message(e.get('code')))) for e in error])
                blocking_level = "error"
                if "404" in error_codes:
                    blocking_level = "warning"
                res[ewaybill] = {
                    "success": False,
                    "error": error_message,
                    "blocking_level": blocking_level,
                }
        if not response.get("error"):
            json_dump = json.dumps(response.get("data"))
            json_name = "%s_ewaybill.json" % (ewaybill.stock_picking_id.name.replace("/", "_"))
            attachment = self.env["ir.attachment"].create({
                "name": json_name,
                "raw": json_dump.encode(),
                "res_model": "l10n.in.ewaybill",
                "res_id": ewaybill.id,
                "mimetype": "application/json",
            })
            inv_res = {"success": True, "attachment": attachment}
            res[ewaybill] = inv_res
        return res

    def _l10n_in_ewaybill_cancel_invoice(self, ewaybill):
        response = {}
        res = {}
        ewaybill_response_json = ewaybill._get_l10n_in_edi_ewaybill_response_json()
        cancel_json = {
            "ewbNo": ewaybill_response_json.get("ewayBillNo") or ewaybill_response_json.get("EwbNo"),
            "cancelRsnCode": int(ewaybill.cancel_reason),
            "CnlRem": ewaybill.cancel_remarks,
        }
        response = self._l10n_in_edi_ewaybill_cancel(ewaybill.company_id, cancel_json)
        if response.get("error"):
            error = response["error"]
            error_codes = [e.get("code") for e in error]
            if "238" in error_codes:
                # Invalid token eror then create new token and send generate request again.
                # This happen when authenticate called from another odoo instance with same credentials (like. Demo/Test)
                authenticate_response = self._l10n_in_edi_ewaybill_authenticate(ewaybill.company_id)
                if not authenticate_response.get("error"):
                    error = []
                    response = self._l10n_in_edi_ewaybill_cancel(ewaybill.company_id, cancel_json)
                    if response.get("error"):
                        error = response["error"]
                        error_codes = [e.get("code") for e in error]
            if "312" in error_codes:
                # E-waybill is already canceled
                # this happens when timeout from the Government portal but IRN is generated
                error_message = Markup("<br/>").join([Markup("[%s] %s") % (e.get("code"), e.get("message") or self._l10n_in_edi_ewaybill_get_error_message(e.get('code'))) for e in error])
                error = []
                response = {"data": ""}
                odoobot = self.env.ref("base.partner_root")
                ewaybill.message_post(author_id=odoobot.id, body=
                    Markup("%s<br/>%s:<br/>%s") % (
                        _("Somehow this E-waybill has been canceled in the government portal before. You can verify by checking the details into the government (https://ewaybillgst.gov.in/Others/EBPrintnew.asp)"),
                        _("Error"),
                        error_message
                    )
                )
            if "no-credit" in error_codes:
                res[ewaybill] = {
                    "success": False,
                    "error": self._l10n_in_edi_get_iap_buy_credits_message(ewaybill.company_id),
                    "blocking_level": "error",
                }
            elif error:
                error_message = Markup("<br/>").join([Markup("[%s] %s") % (e.get("code"), e.get("message") or self._l10n_in_edi_ewaybill_get_error_message(e.get('code'))) for e in error])
                blocking_level = "error"
                if "404" in error_codes:
                    blocking_level = "warning"
                res[ewaybill] = {
                    "success": False,
                    "error": error_message,
                    "blocking_level": blocking_level,
                }
        if not response.get("error"):
            json_dump = json.dumps(response.get("data"))
            json_name = "%s_ewaybill_cancel.json" % (ewaybill.stock_picking_id.name.replace("/", "_"))
            attachment = self.env["ir.attachment"].create({
                "name": json_name,
                "raw": json_dump.encode(),
                "res_model": "l10n.in.ewaybill",
                "res_id": ewaybill.id,
                "mimetype": "application/json",
            })
            inv_res = {"success": True, "attachment": attachment}
            res[ewaybill] = inv_res
        return res

    def _l10n_in_ewaybill_update_part_b(self, ewaybill, val):
        response = {}
        res = {}
        ewaybill_response_json = ewaybill._get_l10n_in_edi_ewaybill_response_json()

        update_part_b_json = {
            "ewbNo": ewaybill_response_json.get("ewayBillNo") or ewaybill_response_json.get("EwbNo"),
            "vehicleNo": val.get("vehicle_no") or "",
            "fromPlace": val.get("update_place") or "",
            "fromStateCode": int(val.get("update_state_id").l10n_in_tin) or "",
            "reasonCode" : int(val.get("update_reason_code")),
            "reasonRem" : val.get("update_remarks"),
            "transDocNo": val.get("transportation_doc_no") or "",
            "transDocDate": val.get("transportation_doc_date") and
                    val.get("transportation_doc_date").strftime("%d/%m/%Y") or "",
            "transMode": val.get("mode"),
            "vehicleType": val.get("vehicle_type") or "",
        }
        response = self._l10n_in_edi_ewaybill_update_part_b(ewaybill.company_id, update_part_b_json)
        if response.get("error"):
            error = response["error"]
            error_codes = [e.get("code") for e in error]
            if "238" in error_codes:
                # Invalid token eror then create new token and send generate request again.
                # This happen when authenticate called from another odoo instance with same credentials (like. Demo/Test)
                authenticate_response = self._l10n_in_edi_ewaybill_authenticate(ewaybill.company_id)
                if not authenticate_response.get("error"):
                    error = []
                    response = self._l10n_in_edi_ewaybill_generate(ewaybill.company_id, update_part_b_json)
                    if response.get("error"):
                        error = response["error"]
                        error_codes = [e.get("code") for e in error]
            if "no-credit" in error_codes:
                res[ewaybill] = {
                    "success": False,
                    "error": self._l10n_in_edi_get_iap_buy_credits_message(ewaybill.company_id),
                    "blocking_level": "error",
                }
            elif error:
                error_message = "<br/>".join(["[%s] %s" % (e.get("code"), html_escape(e.get("message") or self._l10n_in_edi_ewaybill_get_error_message(e.get('code')))) for e in error])
                blocking_level = "error"
                if "404" in error_codes:
                    blocking_level = "warning"
                res[ewaybill] = {
                    "success": False,
                    "error": error_message,
                    "blocking_level": blocking_level,
                }
        if not response.get("error"):
            json_dump = json.dumps(response.get("data"))
            json_name = "%s_ewaybill_updatepartb.json" % (ewaybill.stock_picking_id.name.replace("/", "_"))
            attachment = self.env["ir.attachment"].create({
                "name": json_name,
                "raw": json_dump.encode(),
                "res_model": "l10n.in.ewaybill",
                "res_id": ewaybill.id,
                "mimetype": "application/json",
            })
            inv_res = {"success": True, "attachment": attachment}
            res[ewaybill] = inv_res
        return res

    def _l10n_in_ewaybill_update_transporter(self, ewaybill, val):
        response = {}
        res = {}
        ewaybill_response_json = ewaybill._get_l10n_in_edi_ewaybill_response_json()
        update_transporter_json = {
            "ewbNo": ewaybill_response_json.get("ewayBillNo") or ewaybill_response_json.get("EwbNo"),
            "transporterId": val.get("transporter_id"),
        }
        response = self._l10n_in_edi_ewaybill_update_transporter(ewaybill.company_id, update_transporter_json)
        if response.get("error"):
            error = response["error"]
            error_codes = [e.get("code") for e in error]
            if "238" in error_codes:
                # Invalid token eror then create new token and send generate request again.
                # This happen when authenticate called from another odoo instance with same credentials (like. Demo/Test)
                authenticate_response = self._l10n_in_edi_ewaybill_authenticate(ewaybill.company_id)
                if not authenticate_response.get("error"):
                    error = []
                    response = self._l10n_in_edi_ewaybill_generate(ewaybill.company_id, update_transporter_json)
                    if response.get("error"):
                        error = response["error"]
                        error_codes = [e.get("code") for e in error]
            if "no-credit" in error_codes:
                res[ewaybill] = {
                    "success": False,
                    "error": self._l10n_in_edi_get_iap_buy_credits_message(ewaybill.company_id),
                    "blocking_level": "error",
                }
            elif error:
                error_message = "<br/>".join(["[%s] %s" % (e.get("code"), html_escape(e.get("message") or self._l10n_in_edi_ewaybill_get_error_message(e.get('code')))) for e in error])
                blocking_level = "error"
                if "404" in error_codes:
                    blocking_level = "warning"
                res[ewaybill] = {
                    "success": False,
                    "error": error_message,
                    "blocking_level": blocking_level,
                }
        if not response.get("error"):
            json_dump = json.dumps(response.get("data"))
            json_name = "%s_ewaybill_update_transporter.json" % (ewaybill.stock_picking_id.name.replace("/", "_"))
            attachment = self.env["ir.attachment"].create({
                "name": json_name,
                "raw": json_dump.encode(),
                "res_model": "l10n.in.ewaybill",
                "res_id": ewaybill.id,
                "mimetype": "application/json",
            })
            inv_res = {"success": True, "attachment": attachment}
            res[ewaybill] = inv_res
        return res

    def _l10n_in_ewaybill_extend_validity(self, ewaybill, val):
        response = {}
        res = {}
        ewaybill_response_json = ewaybill._get_l10n_in_edi_ewaybill_response_json()
        extend_validity_json = {
            "ewbNo": ewaybill_response_json.get("ewayBillNo") or ewaybill_response_json.get("EwbNo"),
            "vehicleNo": val.get("vehicle_no") or "",
            "fromPlace": val.get("current_place"),
            "fromStateCode": int(val.get("current_state_id").l10n_in_tin) or "",
            "remainingDistance": val.get("rem_distance"),
            "transDocNo": val.get("transportation_doc_no") or "",
            "transDocDate": val.get("transportation_doc_date") and
                    val.get("transportation_doc_date").strftime("%d/%m/%Y") or "",
            "transMode": val.get("mode"),
            "extnRsnCode": val.get("extend_reason_code"),
            "extnRemarks": val.get("extend_reason_remarks"),
            "fromPincode": int(self._l10n_in_edi_extract_digits(val.get("current_pincode"))),
            "consignmentStatus": val.get("mode") in ('1', '2', '3', '4') and "M" or "T",
            "transitType": val.get("consignment_status") == "T" and val.get("transit_type") or "",
        }
        response = self._l10n_in_edi_ewaybill_extend_validity(ewaybill.company_id, extend_validity_json)
        if response.get("error"):
            error = response["error"]
            error_codes = [e.get("code") for e in error]
            if "238" in error_codes:
                # Invalid token eror then create new token and send generate request again.
                # This happen when authenticate called from another odoo instance with same credentials (like. Demo/Test)
                authenticate_response = self._l10n_in_edi_ewaybill_authenticate(ewaybill.company_id)
                if not authenticate_response.get("error"):
                    error = []
                    response = self._l10n_in_edi_ewaybill_generate(ewaybill.company_id, extend_validity_json)
                    if response.get("error"):
                        error = response["error"]
                        error_codes = [e.get("code") for e in error]
            if "no-credit" in error_codes:
                res[ewaybill] = {
                    "success": False,
                    "error": self._l10n_in_edi_get_iap_buy_credits_message(ewaybill.company_id),
                    "blocking_level": "error",
                }
            elif error:
                error_message = "<br/>".join(["[%s] %s" % (e.get("code"), html_escape(e.get("message") or self._l10n_in_edi_ewaybill_get_error_message(e.get('code')))) for e in error])
                blocking_level = "error"
                if "404" in error_codes:
                    blocking_level = "warning"
                res[ewaybill] = {
                    "success": False,
                    "error": error_message,
                    "blocking_level": blocking_level,
                }
        if not response.get("error"):
            json_dump = json.dumps(response.get("data"))
            json_name = "%s_ewaybill_extendvalidity.json" % (ewaybill.name.replace("/", "_"))
            attachment = self.env["ir.attachment"].create({
                "name": json_name,
                "raw": json_dump.encode(),
                "res_model": "l10n.in.ewaybill",
                "res_id": ewaybill.id,
                "mimetype": "application/json",
            })
            inv_res = {"success": True, "attachment": attachment}
            res[ewaybill] = inv_res
        return res

    def _get_l10n_in_edi_ewaybill_response_json(self):
        self.ensure_one()
        for ewaybill in self:
            if ewaybill.state == "sent" and ewaybill.attachment_id:
                return json.loads(ewaybill.sudo().attachment_id.raw.decode("utf-8"))
            else:
                return {}

    def _get_l10n_in_edi_saler_buyer_party(self, ewaybill):
        return {
            "seller_details": ewaybill.company_id.partner_id,
            "dispatch_details": ewaybill.stock_picking_id.picking_type_id.warehouse_id.partner_id or ewaybill.company_id.partner_id,
            "buyer_details": ewaybill.partner_id,
            "ship_to_details": ewaybill.partner_shipping_id or ewaybill.partner_id,
        }

    @api.model
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

    def _l10n_in_ewaybill_generate_json(self, ewaybill):
        def get_transaction_type(seller_details, dispatch_details, buyer_details, ship_to_details):
            """
                1 - Regular
                2 - Bill To - Ship To
                3 - Bill From - Dispatch From
                4 - Combination of 2 and 3
            """
            if seller_details != dispatch_details and buyer_details != ship_to_details:
                return 4
            elif seller_details != dispatch_details:
                return 3
            elif buyer_details != ship_to_details:
                return 2
            else:
                return 1

        saler_buyer = self._get_l10n_in_edi_saler_buyer_party(ewaybill)
        seller_details = saler_buyer.get("seller_details")
        dispatch_details = saler_buyer.get("dispatch_details")
        buyer_details = saler_buyer.get("buyer_details")
        ship_to_details = saler_buyer.get("ship_to_details")
        extract_digits = self._l10n_in_edi_extract_digits
        tax_details = self._l10n_in_tax_details(ewaybill)

        json_payload = {
            "supplyType": ewaybill.picking_type_code == "outgoing" and "O" or "I",
            "subSupplyType": ewaybill.type_id.sub_type_code,
            "subSupplyDesc": ewaybill.type_id.sub_type_code == '8' and ewaybill.type_desc or "",
            "docType": ewaybill.type_id.code,
            "transactionType": get_transaction_type(seller_details, dispatch_details, buyer_details, ship_to_details),
            "transDistance": str(ewaybill.distance),
            "docNo": ewaybill.stock_picking_id.name,
            "docDate": ewaybill.date.strftime("%d/%m/%Y"),
            "fromGstin": seller_details.country_id.code == "IN" and seller_details.commercial_partner_id.vat or "URP",
            "fromTrdName": seller_details.commercial_partner_id.name,
            "fromAddr1": dispatch_details.street or "",
            "fromAddr2": dispatch_details.street2 or "",
            "fromPlace": dispatch_details.city or "",
            "fromPincode": dispatch_details.country_id.code == "IN" and int(extract_digits(dispatch_details.zip)) or "",
            "fromStateCode": int(seller_details.state_id.l10n_in_tin) or "",
            "actFromStateCode": dispatch_details.state_id.l10n_in_tin and int(dispatch_details.state_id.l10n_in_tin) or "",
            "toGstin": buyer_details.country_id.code == "IN" and buyer_details.commercial_partner_id.vat or "URP",
            "toTrdName": buyer_details.commercial_partner_id.name,
            "toAddr1": ship_to_details.street or "",
            "toAddr2": ship_to_details.street2 or "",
            "toPlace": ship_to_details.city or "",
            "toPincode": int(extract_digits(ship_to_details.zip)),
            "actToStateCode": int(ship_to_details.state_id.l10n_in_tin),
            "toStateCode": int(buyer_details.state_id.l10n_in_tin),
            "itemList": [
                self._get_l10n_in_ewaybill_line_details(line)
                for line in ewaybill.move_ids
            ],
            "totalValue": self._l10n_in_round_value(ewaybill.amount_untaxed),
            "cgstValue": self._l10n_in_round_value(tax_details.get('cgst_amount')),
            "sgstValue": self._l10n_in_round_value(tax_details.get('sgst_amount')),
            "igstValue": self._l10n_in_round_value(tax_details.get('igst_amount')),
            "cessValue": self._l10n_in_round_value(tax_details.get('cess_amount')),
            "cessNonAdvolValue": self._l10n_in_round_value(tax_details.get('cess_non_advol_amount')),
            "otherValue": self._l10n_in_round_value(tax_details.get('other_amount')),
            "totInvValue": self._l10n_in_round_value(ewaybill.amount_total),
        }
        if ewaybill.transporter_id:
            json_payload.update({
            "transporterId": ewaybill.transporter_id.vat,
            "transporterName": ewaybill.transporter_id.name,
            })
        is_overseas = ewaybill.gst_treatment in ("overseas", "special_economic_zone")
        if is_overseas:
            json_payload.update({"toStateCode": 99})
        if is_overseas and ship_to_details.state_id.country_id.code != "IN":
            json_payload.update({
                "actToStateCode": 99,
                "toPincode": 999999,
            })
        else:
            json_payload.update({
                "actToStateCode": int(ship_to_details.state_id.l10n_in_tin),
                "toPincode": int(extract_digits(ship_to_details.zip)),
            })

        if ewaybill.mode in ("2", "3", "4"):
            json_payload.update({
                "transMode": ewaybill.mode,
                "transDocNo": ewaybill.transportation_doc_no or "",
                "transDocDate": ewaybill.transportation_doc_date and
                    ewaybill.transportation_doc_date.strftime("%d/%m/%Y") or "",
            })
        if ewaybill.mode == "1":
            json_payload.update({
                "transMode": ewaybill.mode,
                "vehicleNo": ewaybill.vehicle_no or "",
                "vehicleType": ewaybill.vehicle_type or "",
            })
        return json_payload

    def _get_l10n_in_ewaybill_line_details(self, line):
        extract_digits = self._l10n_in_edi_extract_digits
        tax_details_by_line = self._l10n_in_tax_details_by_line(line)
        line_details = {
            "productName": line.product_id.name,
            "hsnCode": extract_digits(line.product_id.l10n_in_hsn_code),
            "productDesc": line.product_id.name,
            "quantity": line.quantity_done,
            "qtyUnit": line.product_id.uom_id.l10n_in_code and line.product_id.uom_id.l10n_in_code.split("-")[0] or "OTH",
            "taxableAmount": self._l10n_in_round_value(line.price_unit),
        }
        if tax_details_by_line.get('igst_rate'):
            line_details.update({"igstRate": self._l10n_in_round_value(tax_details_by_line.get("igst_rate", 0.00))})
        else:
            line_details.update({
                "cgstRate": self._l10n_in_round_value(tax_details_by_line.get("cgst_rate", 0.00)),
                "sgstRate": self._l10n_in_round_value(tax_details_by_line.get("sgst_rate", 0.00)),
            })
        if tax_details_by_line.get("cess_rate"):
            line_details.update({"cessRate": self._l10n_in_round_value(tax_details_by_line.get("cess_rate", 0.00))})
        return line_details
