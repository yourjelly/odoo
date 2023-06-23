# Part of Odoo. See LICENSE file for full copyright and licensing details.

import json
import re
import logging
import base64
import pytz
from psycopg2 import OperationalError
from datetime import datetime

from odoo import fields, models, api, _
from odoo.exceptions import UserError
from odoo.tools import html_escape

from odoo.addons.l10n_in_ewaybill_stock.tools.ewaybill_api import EWayBillApi
from odoo.addons.l10n_in_edi_ewaybill.models.error_codes import ERROR_CODES

from markupsafe import Markup

_logger = logging.getLogger(__name__)


class Ewaybill(models.Model):
    _name = "l10n.in.ewaybill"
    _description = "Ewaybill for invoice"
    _inherit = ['portal.mixin', 'mail.thread', 'mail.activity.mixin']

    name = fields.Char("e-Way bill Number", copy=False, readonly=True)
    ewaybill_date = fields.Date("e-Way bill Date", copy=False, readonly=True)
    ewaybill_expiry_date = fields.Date("e-Way bill Valid Upto", copy=False, readonly=True)
    cancel_reason = fields.Selection(selection=[
        ("1", "Duplicate"),
        ("2", "Data Entry Mistake"),
        ("3", "Order Cancelled"),
        ("4", "Others"),
    ], string="Cancel reason", copy=False, tracking=True)
    cancel_remarks = fields.Char("Cancel remarks", copy=False, tracking=True)

    document_date = fields.Datetime("Document Date", compute="_compute_document_details")
    document_number = fields.Char("Document", compute="_compute_document_details")
    company_id = fields.Many2one("res.company", compute="_compute_document_details")
    is_overseas = fields.Boolean("Is Overseas", compute="_compute_document_details")

    supply_type = fields.Selection(string="Supply Type", selection=[
        ("O", "Outward"),
        ("I", "Inward")
    ], compute="_compute_supply_type")

    partner_bill_to_id = fields.Many2one("res.partner", string='Bill To', compute="_compute_document_partners_details", store=True, readonly=False)
    partner_bill_from_id = fields.Many2one("res.partner", string='Bill From', compute="_compute_document_partners_details", store=True, readonly=False)
    partner_ship_to_id = fields.Many2one('res.partner', string='Ship To', compute='_compute_document_partners_details', store=True, readonly=False)
    partner_ship_from_id = fields.Many2one("res.partner", string='Ship From', compute="_compute_document_partners_details", store=True, readonly=False)
    is_bill_to_editable = fields.Boolean(compute="_compute_is_editable")
    is_bill_from_editable = fields.Boolean(compute="_compute_is_editable")
    is_ship_to_editable = fields.Boolean(compute="_compute_is_editable")
    is_ship_from_editable = fields.Boolean(compute="_compute_is_editable")
    
    transaction_type = fields.Selection(
        selection=[
            ("inter_state", "Inter State"),
            ("intra_state", "Intra State"),
        ],
        string="Transaction",
        compute="_compute_transaction_type",
        readonly=False,
    )
    state = fields.Selection(string='Status', selection=[
        ('pending', 'Pending'),
        ('to_generate', 'To Generate'),
        ('generated', 'Generated'),
        ('to_cancel', 'To Cancel'),
        ('cancel', 'Cancelled'),
    ], required=True, readonly=True, copy=False, tracking=True, default='pending')
    # Transaction Details
    type_id = fields.Many2one("l10n.in.ewaybill.type", "E-waybill Document Type", tracking=True)
    type_description = fields.Char(string="Description")
    sub_type_code = fields.Char(related="type_id.sub_type_code")

    # transportation details
    distance = fields.Integer("Distance", tracking=True)
    mode = fields.Selection([
        ("0", "Managed by Transporter"),
        ("1", "By Road"),
        ("2", "Rail"),
        ("3", "Air"),
        ("4", "Ship")
    ], string="Transportation Mode", copy=False, tracking=True)

    # Vehicle Number and Type required when transportation mode is By Road.
    vehicle_no = fields.Char("Vehicle Number", copy=False, tracking=True)
    vehicle_type = fields.Selection([
        ("R", "Regular"),
        ("O", "ODC")],
        string="Vehicle Type", copy=False, tracking=True)

    # Document number and date required in case of transportation mode is Rail, Air or Ship.
    transportation_doc_no = fields.Char(
        string="Transporter's Doc No",
        help="""Transport document number. If it is more than 15 chars, last 15 chars may be entered""",
        copy=False, tracking=True)
    transportation_doc_date = fields.Date(
        string="Transporter's Doc Date",
        help="Date on the transporter document",
        copy=False,
        tracking=True)

    # transporter id required when transportation done by other party.
    transporter_id = fields.Many2one("res.partner", "Transporter", copy=False, tracking=True)

    error_message = fields.Html(readonly=True)
    blocking_level = fields.Selection([
        ("warning", "Warning"),
        ("error", "Error")],
        string="Blocking Level", readonly=True)

    content = fields.Binary(compute='_compute_content', compute_sudo=True)

    # fields for stock picking ewaybill generation
    stock_picking_id = fields.Many2one("stock.picking", "Stock Transfer", copy=False)
    move_ids = fields.One2many(comodel_name='stock.move', related="stock_picking_id.move_ids", inverse_name='ewaybill_id', readonly=False, store=True)
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
            if ewaybill.picking_type_code == 'incoming':
                ewaybill.supply_type = 'I'
            else:
                ewaybill.supply_type = 'O'

    @api.depends('partner_bill_to_id', 'partner_bill_from_id')
    def _compute_document_details(self):
        for ewaybill in self:
            ewaybill.is_overseas = False
            stock_picking_id = ewaybill.stock_picking_id
            ewaybill.document_number = stock_picking_id.name
            ewaybill.company_id = stock_picking_id.company_id.id
            ewaybill.document_date = stock_picking_id.date_done or stock_picking_id.scheduled_date

            if ewaybill.picking_type_code == 'incoming':
                gst_treatment = ewaybill.partner_bill_from_id.l10n_in_gst_treatment
            else:
                gst_treatment = ewaybill.partner_bill_to_id.l10n_in_gst_treatment

            if gst_treatment in ('overseas', 'special_economic_zone'):
                ewaybill.is_overseas = True

            if not gst_treatment:
                raise UserError("Set the GST Treatment in Partner")

    @api.depends('stock_picking_id')
    def _compute_document_partners_details(self):
        for ewaybill in self:
            stock_picking_id = ewaybill.stock_picking_id
            if stock_picking_id:
                if ewaybill.picking_type_code == 'incoming':
                    ewaybill.partner_bill_to_id = stock_picking_id.company_id.partner_id
                    ewaybill.partner_bill_from_id = stock_picking_id.partner_id
                    ewaybill.partner_ship_to_id = stock_picking_id.company_id.partner_id
                    ewaybill.partner_ship_from_id = stock_picking_id.partner_id
                else:
                    ewaybill.partner_bill_to_id = stock_picking_id.partner_id
                    ewaybill.partner_bill_from_id = stock_picking_id.company_id.partner_id
                    ewaybill.partner_ship_to_id = stock_picking_id.partner_id
                    ewaybill.partner_ship_from_id = stock_picking_id.company_id.partner_id

    @api.depends('partner_bill_from_id', 'partner_bill_to_id')
    def _compute_transaction_type(self):
        for ewaybill in self:
            if ewaybill.partner_bill_from_id.state_id == ewaybill.partner_bill_to_id.state_id:
                ewaybill.transaction_type = 'intra_state'
            else:
                ewaybill.transaction_type = 'inter_state'

    @api.depends('partner_ship_from_id', 'partner_ship_from_id', 'partner_bill_from_id', 'partner_bill_to_id')
    def _compute_is_editable(self):
        for ewaybill in self:
            if ewaybill.picking_type_code == "incoming":
                ewaybill.is_bill_to_editable = False
                ewaybill.is_bill_from_editable = True
                if ewaybill.is_overseas:
                    ewaybill.is_ship_from_editable = True
                    ewaybill.is_ship_to_editable = False
                else:
                    ewaybill.is_ship_from_editable = False
                    ewaybill.is_ship_to_editable = False
            else:
                ewaybill.is_bill_to_editable = True
                ewaybill.is_bill_from_editable = False
                if not ewaybill.is_overseas:
                    ewaybill.is_ship_to_editable = True
                    ewaybill.is_ship_from_editable = False
                else:
                    ewaybill.is_ship_to_editable = False
                    ewaybill.is_ship_from_editable = False

    @api.depends('state')
    def _compute_content(self):
        for ewaybill in self:
            res = b''
            base = ewaybill._get_ewaybill_mode()
            if base == "direct":
                res = base64.b64encode(
                    json.dumps(ewaybill._ewaybill_generate_direct_json()).encode()
                )
            ewaybill.content = res

    @api.depends('name', 'state')
    def _compute_display_name(self):
        for account in self:
            if self.name:
                account.display_name = self.name
            else:
                account.display_name = _('Pending')

    def action_export_json(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_url',
            'url': '/web/content/l10n.in.ewaybill/%s/content' % self.id
        }

    def _get_ewaybill_mode(self):
        """
            There is two type of api call to create E-waybill
            1. base on IRN, IRN is number created when we do E-invoice (owerwrite in l10n_in_ewaybill_irn module)
            2. direct call, when E-invoice not aplicable or it"s credit not
        """
        self.ensure_one()
        return "direct"

    def _indian_timezone_to_odoo_utc(self, str_date, time_format="%Y-%m-%d %H:%M:%S"):
        """
            This method is used to convert date from Indian timezone to UTC
        """
        local_time = datetime.strptime(str_date, time_format)
        utc_time = local_time.astimezone(pytz.utc)
        return fields.Datetime.to_string(utc_time)

    def generate_ewaybill(self):
        for ewaybill in self:
            if ewaybill.state != "pending":
                state = dict(self._fields['state'].get_values(ewaybill.env))[ewaybill.state]
                raise UserError(_("E-waybill can't generated from %s state", state))
            errors = ewaybill._check_ewaybill_configuration()
            if errors:
                raise UserError('\n'.join(errors))
            ewaybill.state = 'to_generate'
        if self:
            self.env.ref('l10n_in_ewaybill_stock.ir_cron_process_ewaybill')._trigger()

    def cancel_ewaybill(self):
        for ewaybill in self:
            if ewaybill.state != "generated":
                raise UserError(_("E-waybill can't cancel from '%s' state", dict(self._fields['state'].selection)[ewaybill.state]))

            if not (ewaybill.cancel_reason or ewaybill.cancel_remarks):
                raise UserError(_("Set cancel reason and remarks to cancel E-waybill"))
            ewaybill.state = 'to_cancel'
        if self:
            self.env.ref('l10n_in_ewaybill_stock.ir_cron_process_ewaybill')._trigger()

    def process_now(self):
        self.ensure_one()
        self._process_ewaybill()

    def _check_ewaybill_transportation_details(self):
        self.ensure_one()
        error_message = []
        base = self._get_ewaybill_mode()
        if base == "irn":
            # already checked by E-invoice (l10n_in_edi) so no need to check
            return error_message
        if not self.type_id and base == "direct":
            error_message.append(_("- Document Type is required"))
        if not self.mode:
            error_message.append(_("- Transportation Mode"))
        elif self.mode == "0" and not self.transporter_id:
            error_message.append(_("- Transporter is required when E-waybill is managed by transporter"))
        elif self.mode == "0" and self.transporter_id and not self.transporter_id.vat:
            error_message.append(_("- Selected Transporter is missing GSTIN"))
        elif self.mode == "1":
            if not self.vehicle_no and self.vehicle_type:
                error_message.append(_("- Vehicle Number and Type is required when Transportation Mode is By Road"))
        elif self.mode in ("2", "3", "4"):
            if not self.transportation_doc_no and self.transportation_doc_date:
                error_message.append(
                    _("- Transport document number and date is required when Transportation Mode is Rail,Air or Ship"))
        if error_message:
            error_message.insert(0, _("The following information are missing"))
        return error_message

    def _check_ewaybill_partners(self):
        self.ensure_one()
        error_message = []
        AccountEdiFormat = self.env['account.edi.format']
        error_message += AccountEdiFormat._l10n_in_validate_partner(self.partner_bill_to_id)
        error_message += AccountEdiFormat._l10n_in_validate_partner(self.partner_bill_from_id)
        error_message += AccountEdiFormat._l10n_in_validate_partner(self.partner_ship_to_id)
        error_message += AccountEdiFormat._l10n_in_validate_partner(self.partner_ship_to_id)
        return error_message

    def _check_ewaybill_document_number(self):
        self.ensure_one()
        if self.document_number:
            if not re.match("^.{1,16}$", self.document_number):
                return [_("Document number should be set and not more than 16 characters")]
        return []

    def _check_lines(self):
        goods_line_is_available = False
        error_message = []
        for line in self.move_ids:
            goods_line_is_available = True
            if line.product_id:
                hsn_code = self.env['account.edi.format']._l10n_in_edi_extract_digits(line.product_id.l10n_in_hsn_code)
                if not hsn_code:
                    error_message.append(_("HSN code is not set in product %s", line.product_id.name))
                elif not re.match("^[0-9]+$", hsn_code):
                    error_message.append(_(
                        "Invalid HSN Code (%s) in product %s", hsn_code, line.product_id.name
                    ))
            else:
                error_message.append(_("Product is required to get HSN code"))
        if not goods_line_is_available:
            error_message.append(_('You need at least one product having "Product Type" as stockable or consumable'))
        return error_message

    def _check_ewaybill_configuration(self):
        self.ensure_one()
        error_message = []
        base = self._get_ewaybill_mode()
        error_message += self._check_ewaybill_transportation_details()
        # only send this details if this is direct mode
        if base == "direct":
            error_message += self._check_ewaybill_partners()
            error_message += self._check_ewaybill_document_number()
            error_message += self._check_lines()
        return error_message

    def _write_error(self, error_message, blocking_level='error'):
        self.ensure_one()
        self.write({
            'error_message': error_message,
            'blocking_level': blocking_level,
        })

    def _write_response(self, response_vals):
        self.ensure_one()
        response_vals = response_vals or {}
        response_vals.update({
            'error_message': False,
            'blocking_level': False,
        })
        self.write(response_vals)

    def _ewaybill_cancel(self):
        self.ensure_one()
        cancel_json = {
            "ewbNo": int(self.name),
            "cancelRsnCode": int(self.cancel_reason),
            "CnlRem": self.cancel_remarks,
        }
        ewb_api = EWayBillApi(self.company_id)
        response = ewb_api._ewaybill_cancel(cancel_json)
        if response.get("error"):
            error = response["error"]
            error_codes = [e.get("code") for e in error]
            if "238" in error_codes:
                # Invalid token eror then create new token and send generate request again.
                # This happens when authenticate called from another odoo instance with same credentials (like. Demo/Test)
                authenticate_response = self._ewaybill_authenticate()
                if not authenticate_response.get("error"):
                    error = []
                    response = ewb_api._ewaybill_cancel(cancel_json)
                    if response.get("error"):
                        error = response["error"]
                        error_codes = [e.get("code") for e in error]
            if "312" in error_codes:
                # E-waybill is already canceled
                # this happens when timeout from the Government portal but IRN is generated
                error_message = Markup("<br/>").join([Markup("[%s] %s") % (
                e.get("code"), e.get("message") or self._l10n_in_ewaybill_get_error_message(e.get('code'))) for e in
                                                      error])
                error = []
                response = {"data": ""}
                odoobot = self.env.ref("base.partner_root")
                self.message_post(author_id=odoobot.id, body=
                Markup("%s<br/>%s:<br/>%s") % (
                    _("Somehow this E-waybill has been canceled in the government portal before. You can verify by checking the details into the government (https://ewaybillgst.gov.in/Others/EBPrintnew.asp)"),
                    _("Error"),
                    error_message
                )
                                  )
            if "no-credit" in error_codes:
                error_message = self.env['account.edi.format']._l10n_in_edi_get_iap_buy_credits_message(self.company_id)
                self._write_error(error_message)
            elif error:
                error_message = Markup("<br/>").join([Markup("[%s] %s") % (
                e.get("code"), e.get("message") or self._l10n_in_ewaybill_get_error_message(e.get('code'))) for e in
                                                      error])
                blocking_level = "error"
                if "404" in error_codes:
                    blocking_level = "warning"
                self._write_error(error_message, blocking_level)
        if not response.get("error"):
            self._write_response({'state': 'cancel'})

    def _process_ewaybill_cron(self, job_count=None):
        ewaybills_to_process = self.env['l10n.in.ewaybill'].search([('state', 'in', ['to_generate', 'to_cancel'])],
                                                                   limit=job_count)
        ewaybills_to_process._process_ewaybill(with_commit=True)
        # If job_count and record count is same then we assume that there are more records to process
        if job_count and len(ewaybills_to_process) == job_count:
            self.env.ref('l10n_in_ewaybill_stock.ir_cron_process_ewaybill')._trigger()

    def _process_ewaybill(self, with_commit=False):
        for ewaybill in self.filtered(lambda ewaybill: ewaybill.state in ['to_generate', 'to_cancel']):
            try:
                with self.env.cr.savepoint(flush=False):
                    self._cr.execute('SELECT * FROM l10n_in_ewaybill WHERE id IN %s FOR UPDATE NOWAIT',
                                     [tuple(ewaybill.ids)])
            except OperationalError as e:
                if e.pgcode == '55P03':
                    _logger.debug('Another transaction already locked e-WayBill rows. Cannot process e-WayBill.')
                    if not with_commit:
                        raise UserError(_('This e-WayBill is being sent by another process already.'))
                    continue
                else:
                    raise e
            if self.state == "to_generate":
                mode = self._get_ewaybill_mode()
                method = "_generate_ewaybill_%s" % mode
                generate_ewaybill_function = getattr(self, method)
                if generate_ewaybill_function is None:
                    UserError(_("eWayBill Generate Method is not defined for mode %s", mode))
                generate_ewaybill_function()
            if self.state == 'to_cancel':
                self._ewaybill_cancel()
            if with_commit:
                ewaybill.cr.commit()

    def _generate_ewaybill_direct(self):
        self.ensure_one()
        if self._get_ewaybill_mode() != "direct":
            return
        ewb_api = EWayBillApi(self.company_id)
        generate_json = self._ewaybill_generate_direct_json()
        response = ewb_api._ewaybill_generate(generate_json)
        if response.get("error"):
            error = response["error"]
            error_codes = [e.get("code") for e in error]
            if "238" in error_codes:
                # Invalid token eror then create new token and send generate request again.
                # This happens when authenticate called from another odoo instance with same credentials (like. Demo/Test)
                authenticate_response = self._ewaybill_authenticate()
                if not authenticate_response.get("error"):
                    error = []
                    response = self._generate_ewaybill_direct()
                    if response.get("error"):
                        error = response["error"]
                        error_codes = [e.get("code") for e in error]
            if "604" in error_codes:
                # Get E-waybill by details in case of E-waybill is already generated
                # this happens when timeout from the Government portal but E-waybill is generated
                response = ewb_api._ewaybill_get_by_consigner(generate_json.get("docType"), generate_json.get("docNo"))
                if not response.get("error"):
                    error = []
                    odoobot = self.env.ref("base.partner_root")
                    self.message_post(author_id=odoobot.id, body=
                    _("Somehow this E-waybill has been generated in the government portal before. You can verify by checking the invoice details into the government (https://ewaybillgst.gov.in/Others/EBPrintnew.asp)")
                                      )
            if "no-credit" in error_codes:
                error_message = self.env['account.edi.format']._l10n_in_edi_get_iap_buy_credits_message(self.company_id)
                self._write_error(error_message)
            elif error:
                error_message = "<br/>".join(["[%s] %s" % (
                e.get("code"), html_escape(e.get("message") or self._l10n_in_ewaybill_get_error_message(e.get('code'))))
                                              for e in error])
                blocking_level = "error"
                if "404" in error_codes:
                    blocking_level = "warning"
                self._write_error(error_message, blocking_level)
        if not response.get("error"):
            self.state = 'generated'
            self.stock_picking_id.ewaybill_id = self.id
            response_data = response.get("data")
            self._write_response({
                'name': response_data.get("ewayBillNo"),
                'ewaybill_date': self._indian_timezone_to_odoo_utc(response_data.get('ewayBillDate'), '%d/%m/%Y %I:%M:%S %p'),
                'ewaybill_expiry_date': self._indian_timezone_to_odoo_utc(response_data.get('validUpto'), '%d/%m/%Y %I:%M:%S %p'),
            })

    def _l10n_in_ewaybill_get_error_message(self, code):
        error_message = ERROR_CODES.get(code)
        return error_message or _("We don't know the error message for this error code. Please contact support.")

    @api.model
    def _get_partner_state_code(self, partner):
        state_code = 99
        if partner.country_id.code == "IN":
            state_code = partner.state_id.l10n_in_tin and int(partner.state_id.l10n_in_tin) or False
        return state_code

    @api.model
    def _get_partner_zip(self, partner):
        state_code = 999999
        if partner.country_id.code == "IN":
            state_code = partner.zip and int(partner.zip) or False
        return state_code

    @api.model
    def _get_partner_gst_number(self, partner):
        state_code = "URP"
        if partner.country_id.code == "IN":
            state_code = partner.commercial_partner_id.vat
        return state_code

    def _l10n_in_tax_details_by_line(self, move):
        taxes = move.ewaybill_tax_ids.compute_all(price_unit=move.price_unit, quantity=move.quantity)
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
        extract_digits = AccountEdiFormat._l10n_in_edi_extract_digits
        tax_details_by_line = self._l10n_in_tax_details_by_line(line)
        line_details = {
            "productName": line.product_id.name,
            "hsnCode": extract_digits(line.product_id.l10n_in_hsn_code),
            "productDesc": line.product_id.name,
            "quantity": line.quantity,
            "qtyUnit": line.product_id.uom_id.l10n_in_code and line.product_id.uom_id.l10n_in_code.split("-")[
                0] or "OTH",
            "taxableAmount": round_value(line.price_unit),
        }
        if tax_details_by_line.get('igst_rate'):
            line_details.update({"igstRate": round_value(tax_details_by_line.get("igst_rate", 0.00))})
        else:
            line_details.update({
                "cgstRate": round_value(tax_details_by_line.get("cgst_rate", 0.00)),
                "sgstRate": round_value(tax_details_by_line.get("sgst_rate", 0.00)),
            })
        if tax_details_by_line.get("cess_rate"):
            line_details.update({"cessRate": round_value(tax_details_by_line.get("cess_rate", 0.00))})
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

            partner_bill_to_id = self.partner_bill_to_id
            partner_bill_from_id = self.partner_bill_from_id
            partner_ship_to_id = self.partner_ship_to_id
            partner_ship_from_id = self.partner_ship_from_id
            AccountEdiFormat = self.env['account.edi.format']
            json_payload = {
                # document details
                "supplyType": self.supply_type,
                "subSupplyType": self.type_id.sub_type_code,
                "docType": self.type_id.code,
                "transactionType": get_transaction_type(partner_ship_to_id, partner_ship_from_id, partner_bill_to_id,
                                                        partner_bill_from_id),
                "transDistance": str(self.distance),
                "docNo": self.document_number,
                "docDate": self.document_date.strftime("%d/%m/%Y"),
                # Bill from
                "fromGstin": self._get_partner_gst_number(partner_bill_from_id),
                "fromTrdName": partner_bill_from_id.commercial_partner_id.name,
                "fromStateCode": self._get_partner_state_code(partner_bill_from_id),
                # Ship from
                "fromAddr1": partner_ship_from_id.street or "",
                "fromAddr2": partner_ship_from_id.street2 or "",
                "fromPlace": partner_ship_from_id.city or "",
                "fromPincode": self._get_partner_zip(partner_ship_from_id),
                "actFromStateCode": self._get_partner_state_code(partner_ship_from_id),
                # Bill to
                "toGstin": self._get_partner_gst_number(partner_bill_to_id),
                "toTrdName": partner_bill_to_id.commercial_partner_id.name,
                "actToStateCode": self._get_partner_state_code(partner_bill_to_id),
                # Ship to
                "toAddr1": partner_ship_to_id.street or "",
                "toAddr2": partner_ship_to_id.street2 or "",
                "toPlace": partner_ship_to_id.city or "",
                "toStateCode": self._get_partner_state_code(partner_ship_to_id),
                "toPincode": self._get_partner_zip(partner_ship_to_id),
            }
            if self.sub_type_code == '8':
                json_payload.update({
                    "subSupplyDesc": self.type_description,
                })
            if self.mode == "0":
                json_payload.update({
                    "transporterId": self.transporter_id.vat or "",
                    "transporterName": self.transporter_id.name or "",
                })
            if self.mode in ("2", "3", "4"):
                json_payload.update({
                    "transMode": self.mode,
                    "transDocNo": self.transportation_doc_no or "",
                    "transDocDate": self.transportation_doc_date and
                                    self.transportation_doc_date.strftime("%d/%m/%Y") or "",
                })
            if self.mode == "1":
                json_payload.update({
                    "transMode": self.mode,
                    "vehicleNo": self.vehicle_no or "",
                    "vehicleType": self.vehicle_type or "",
                })
            if self.stock_picking_id:
                tax_details = self._l10n_in_tax_details(ewaybill)
                round_value = AccountEdiFormat._l10n_in_round_value
                json_payload.update({
                    "itemList": [
                        self._get_l10n_in_ewaybill_line_details(line)
                        for line in ewaybill.move_ids
                    ],
                    "totalValue": round_value(ewaybill.amount_untaxed),
                    "cgstValue": round_value(tax_details.get('cgst_amount', 0.00)),
                    "sgstValue": round_value(tax_details.get('sgst_amount', 0.00)),
                    "igstValue": round_value(tax_details.get('igst_amount', 0.00)),
                    "cessValue": round_value(tax_details.get('cess_amount', 0.00)),
                    "cessNonAdvolValue": round_value(tax_details.get('cess_non_advol_amount', 0.00)),
                    "otherValue": round_value(tax_details.get('other_amount', 0.00)),
                    "totInvValue": round_value(ewaybill.amount_total),
                })
            return json_payload

    def _get_ewaybill_line_details_invoice(self, line, line_tax_details, sign):
        AccountEdiFormat = self.env['account.edi.format']
        tax_details_by_code = AccountEdiFormat._get_l10n_in_tax_details_by_line_code(
            line_tax_details.get("tax_details", {}))
        line_details = {
            "productName": line.product_id.name,
            "hsnCode": AccountEdiFormat._l10n_in_edi_extract_digits(line.product_id.l10n_in_hsn_code),
            "productDesc": line.name,
            "quantity": line.quantity,
            "qtyUnit": line.product_id.uom_id.l10n_in_code and line.product_id.uom_id.l10n_in_code.split("-")[
                0] or "OTH",
            "taxableAmount": AccountEdiFormat._l10n_in_round_value(line.balance * sign),
        }
        if tax_details_by_code.get("igst_rate") or (
                self.partner_bill_to_id.state_id != self.partner_bill_from_id.state_id):
            line_details.update(
                {"igstRate": AccountEdiFormat._l10n_in_round_value(tax_details_by_code.get("igst_rate", 0.00))})
        else:
            line_details.update({
                "cgstRate": AccountEdiFormat._l10n_in_round_value(tax_details_by_code.get("cgst_rate", 0.00)),
                "sgstRate": AccountEdiFormat._l10n_in_round_value(tax_details_by_code.get("sgst_rate", 0.00)),
            })
        if tax_details_by_code.get("cess_rate"):
            line_details.update(
                {"cessRate": AccountEdiFormat._l10n_in_round_value(tax_details_by_code.get("cess_rate"))})
        return line_details
