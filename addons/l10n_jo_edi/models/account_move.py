import json
import requests
import uuid

from odoo import _, api, fields, models
from odoo.exceptions import UserError

JOFOTARA_URL = "https://backend.jofotara.gov.jo/core/invoices/"


class AccountMove(models.Model):
    _inherit = 'account.move'

    l10n_jo_edi_uuid = fields.Char(string="Invoice UUID", copy=False, compute="_compute_l10n_jo_edi_uuid", store=True)
    l10n_jo_edi_qr = fields.Char(string="QR", copy=False)

    l10n_jo_edi_is_needed = fields.Boolean(
        compute="_compute_l10n_jo_edi_is_needed",
        help="Jordan: technical field to determine if this invoice is eligible to be e-invoiced.",
    )
    l10n_jo_edi_state = fields.Selection(
        selection=[('to_send', 'To Send'), ('sent', 'Sent')],
        string="JoFotara State",
        copy=False)
    l10n_jo_edi_error = fields.Text(
        string="JoFotara Error",
        copy=False,
        readonly=True,
        help="Jordan: Error details.",
    )
    l10n_jo_edi_xml_attachment_file = fields.Binary(
        string="Jordan E-Invoice XML File",
        copy=False,
        attachment=True,
        help="Jordan: technical field holding the e-invoice XML data.",
    )
    l10n_jo_edi_xml_attachment_id = fields.Many2one(
        comodel_name="ir.attachment",
        string="Jordan E-Invoice XML",
        compute=lambda self: self._compute_linked_attachment_id(
            "l10n_jo_edi_xml_attachment_id", "l10n_jo_edi_xml_attachment_file"
        ),
        depends=["l10n_jo_edi_xml_attachment_file"],
        help="Jordan: e-invoice XML.",
    )

    @api.depends("country_code", "move_type")
    def _compute_l10n_jo_edi_is_needed(self):
        for move in self:
            move.l10n_jo_edi_is_needed = (
                move.country_code == "JO"
                and move.move_type in ("out_invoice", "out_refund")
            )

    @api.depends("l10n_jo_edi_xml_attachment_id", "l10n_jo_edi_error")
    def _compute_show_reset_to_draft_button(self):
        # EXTENDS 'account'
        super()._compute_show_reset_to_draft_button()
        self.filtered(lambda move: move.l10n_jo_edi_state == 'sent').show_reset_to_draft_button = False

    def button_draft(self):
        # EXTENDS 'account'
        self.write(
            {
                "l10n_jo_edi_error": False,
                "l10n_jo_edi_xml_attachment_file": False,
                "l10n_jo_edi_state": False,
            }
        )
        return super().button_draft()

    def action_post(self):
        # EXTENDS 'account'
        for invoice in self.filtered('l10n_jo_edi_is_needed'):
            invoice.l10n_jo_edi_state = 'to_send'
        return super().action_post()

    def _l10n_jo_build_jofotara_headers(self):
        self.ensure_one()
        return {
            'Client-Id': self.company_id.l10n_jo_edi_client_id,
            'Secret-Key': self.company_id.l10n_jo_edi_secret_key,
            'Content-Type': 'application/json',
        }

    def _submit_to_jofotara(self):
        self.ensure_one()
        headers = self._l10n_jo_build_jofotara_headers()
        params = '{"invoice": "%s"}' % self.l10n_jo_edi_xml_attachment_id.datas.decode('ascii')

        try:
            response = requests.post(JOFOTARA_URL, data=str(params), headers=headers, timeout=50, verify=False)
        except requests.exceptions.Timeout:
            return "Request time out! Please try again."
        except (requests.exceptions.RequestException, requests.exceptions.HTTPError) as e:
            return f"Invalid request: {e}"

        response_text = response.content.decode()
        if not response.ok:
            return f"Request failed: {response_text}"
        dict_response = json.loads(response_text)
        self.l10n_jo_edi_qr = str(dict_response.get('EINV_QR', ''))

    def _l10n_jo_qr_code_src(self):
        self.ensure_one()
        return f'/report/barcode/?barcode_type=QR&value={self.l10n_jo_edi_qr}&width=200&height=200'

    def _l10n_jo_edi_get_xml_attachment_name(self):
        return f"{self.name.replace('/', '_')}_edi.xml"

    def _l10n_jo_validate_config(self):
        error_msg = ''
        if not self.company_id.l10n_jo_edi_client_id:
            error_msg += "Client ID is missing.\n"
        if not self.company_id.l10n_jo_edi_secret_key:
            error_msg += "Secret key is missing.\n"
        if not self.company_id.l10n_jo_edi_taxpayer_type:
            error_msg += "Taxpayer type is missing.\n"
        if not self.company_id.l10n_jo_edi_sequence_income_source:
            error_msg += "Activity number (Sequence of income source) is missing.\n"

        if error_msg:
            raise UserError(f"{error_msg} To set: Configuration > Settings > Electronic Invoicing (Jordan)")

    @api.depends("l10n_jo_edi_is_needed")
    def _compute_l10n_jo_edi_uuid(self):
        for invoice in self:
            if invoice.l10n_jo_edi_is_needed and not invoice.l10n_jo_edi_uuid:
                invoice.l10n_jo_edi_uuid = uuid.uuid4()

    def _l10n_jo_edi_send(self):
        self._l10n_jo_validate_config()
        for invoice in self:
            invoice_xml = self.env["ir.attachment"].create(
                {
                    "res_model": "account.move",
                    "res_id": invoice.id,
                    "res_field": "l10n_jo_edi_xml_attachment_file",
                    "name": invoice._l10n_jo_edi_get_xml_attachment_name(),
                    "raw": invoice.env['account.edi.xml.ubl_21.jo']._export_invoice(invoice),
                }
            )
            invoice.invalidate_recordset(
                fnames=[
                    "l10n_jo_edi_xml_attachment_id",
                    "l10n_jo_edi_xml_attachment_file",
                ]
            )

            if error_message := invoice._submit_to_jofotara():
                invoice.l10n_jo_edi_error = error_message
                return error_message
            else:
                invoice.l10n_jo_edi_error = False
                invoice.l10n_jo_edi_state = 'sent'
                invoice.with_context(no_new_invoice=True).message_post(
                    body=_("E-invoice (JoFotara) submitted successfully."),
                    attachment_ids=invoice_xml.ids,
                )
