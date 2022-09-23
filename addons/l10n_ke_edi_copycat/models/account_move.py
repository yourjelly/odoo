# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import logging
import json
import re

from odoo import models, fields, api, _
from odoo.exceptions import UserError
from odoo.tools import html_escape
from odoo.tools.float_utils import json_float_round

_logger = logging.getLogger(__name__)


class AccountMove(models.Model):
    _inherit = 'account.move'

    l10n_ke_json_request = fields.Char('Technical field with the json request.', copy=False)
    l10n_ke_json_response = fields.Char('Technical field with the json response.', copy=False)
    l10n_ke_control_unit_signing_datetime = fields.Date(string='KRA signing date and time')

    # Computed fields
    l10n_ke_control_unit_code = fields.Char(string='Control unit code', compute='_compute_l10n_ke_control_unit_info')
    l10n_ke_control_unit_serial_number = fields.Char(string='Control unit serial number', compute='_compute_l10n_ke_control_unit_info')
    l10n_ke_middleware_number = fields.Integer(string='Middleware integer invoice', compute='_compute_l10n_ke_control_unit_info', store=True, copy=False)
    l10n_ke_qrcode = fields.Char(string='KRA QR Code', compute='_compute_l10n_ke_control_unit_info')
    l10n_ke_edi_status = fields.Char(compute='_compute_l10n_ke_control_unit_info')

    # -------------------------------------------------------------------------
    # COMPUTE FUNCTIONS
    # -------------------------------------------------------------------------

    @api.depends('l10n_ke_json_response')
    def _compute_l10n_ke_control_unit_info(self):
        """ All of these fields can be computed from the single repsonse """

        for move in self:
            response = {}
            if move.l10n_ke_json_response:
                # When the request is initally sent, the content of the json field will be only the request, for this reason, the dict here can be empty
                response = json.loads(move.l10n_ke_json_response)
            move.l10n_ke_qrcode = response.get('qrCode')
            move.l10n_ke_control_unit_code = response.get('controlCode')
            move.l10n_ke_control_unit_serial_number = response.get('serialNo')
            move.l10n_ke_middleware_number = response.get('middlewareInvoiceNumber')

    # -------------------------------------------------------------------------
    # HELPERS
    # -------------------------------------------------------------------------

    @api.model
    def _l10n_ke_remove_special_chars(self, name):
        new_name = re.sub('[^A-Za-z0-9 ]+', '', name)
        return new_name

    @api.model
    def _format_error_message(self, error_title, errors):
        bullet_list_msg = ''.join('<li>%s</li>' % html_escape(msg) for msg in errors)
        return

    @api.model
    def _l10n_ke_edi_is_managing_invoice_negative_lines_allowed(self):
        """ Negative lines are not allowed, making some features unavailable like sale_coupon or global discounts.
        This method allows odoo to distribute the negative discount lines to each others making such features
        available.

        :return: True if odoo needs to distribute the negative discount lines, False otherwise.
        """
        param_name = 'l10n_ke_edi.manage_invoice_negative_lines'
        return bool(self.env['ir.config_parameter'].sudo().get_param(param_name))

    # -------------------------------------------------------------------------
    # CHECKS
    # -------------------------------------------------------------------------
    def _l10n_ke_check_communication_configuration(self):
        """ Checks to be run regarding regarding the request itself """
        errors = []
        # Ensure that the proxy device address is set
        if not self.company_id.l10n_ke_device_proxy_url:
            errors.append(_("The address of the proxy device must be defined on the company."))

        # Ensure that the sender id is set
        if not self.company_id.l10n_ke_device_proxy_url:
            errors.append(_("The sender id for the fiscal device must be defined on the company."))

        return errors

    def _l10n_ke_check_move_configuration(self):
        """ Checks to be run on the move before sending to the fiscal device """
        self.ensure_one()
        errors = []

        if self.move_type not in ['out_invoice', 'out_refund']:
            errors.append(_("The document being sent must be a customer invoice or a credit note."))

        # The credit note / debit note should refer to the middleware number (reciept number)
        # of the original invoice to which it relates.
        if self.move_type == 'out_refund' and not self.reversed_entry_id.l10n_ke_middleware_number:
            errors.append(_("This credit note must reference the previous invoice, and this previous invoice must have already been submitted."))

        # The systemUser is a required field
        if not self.user_id.name:
            errors.append(_("The document being sent must be associated to a named user."))

        return errors

    def _l10n_ke_check_move_lines_configuration(self):
        """ Checks to be run on the move lines before sending to the fiscal device """
        self.ensure_one()
        errors = []

        negative_lines_allowed = self._l10n_ke_edi_is_managing_invoice_negative_lines_allowed()

        for line in self.invoice_line_ids.filtered(lambda l: not l.display_type):
            if len(line.tax_ids) != 1:
                errors.append(_("In line %s you must select one and only one VAT tax.", line.name))
            elif line.tax_ids.amount == 0:
                # In the case where taxes are zero rated, HS code, is mandatory
                if not line.product_id or not line.product_id.l10n_ke_hs_code or not line.product_id.l10n_ke_hs_description:
                    errors.append(_("Line %s features a tax that is zero rated or exempt. The HS code and HS description are " +
                                    "required, please set them for the product on the line."))

            if line.quantity <= 0:
                errors.append(_("In line %s the quantity must be positive.", line.name))

            if line.price_subtotal <= 0 and not negative_lines_allowed:
                errors.append(_("The amount on line %s is negative, negative amounts are not accepted by the " +
                                "Kenyan government. Please create a credit note instead.", line.name))

        return errors


    # -------------------------------------------------------------------------
    # EXPORT
    # -------------------------------------------------------------------------

    def _l10n_ke_get_initial_lines_dict(self):
        self.ensure_one()
        lines = []
        for line in self.invoice_line_ids.filtered(lambda l: not l.display_type):
            price_subtotal = abs(line.balance)
            if line.quantity and line.discount != 100.0:
                price_unit = price_subtotal / ((1 - (line.discount or 0.0) / 100.0) * abs(line.quantity))
            else:
                price_unit = line.price_unit
            line = {'price_unit': price_unit,
                    'quantity': line.quantity,
                    'tax_ids': line.tax_ids,
                    'discount': line.discount,
                    'line': line}
            lines.append(line)
        return lines

    def _l10n_ke_global_discount_transform_dict(self, lines):

        def is_discount_line(line):
            return line['price_unit'] < 0.0

        def is_candidate(discount_line, other_line):
            discount_taxes = discount_line['tax_ids'].flatten_taxes_hierarchy()
            other_line_taxes = other_line['tax_ids'].flatten_taxes_hierarchy()
            return set(discount_taxes.ids) == set(other_line_taxes.ids)

        for line in lines:
            if not is_discount_line(line):
                continue

            # Search for non-discount lines
            candidate_vals_list = [l for l in lines if not is_discount_line(l) and is_candidate(l, line)]
            candidate_vals_list = sorted(candidate_vals_list, key=lambda x: x['price_unit'] * x['quantity'], reverse=True)
            line_to_discount = abs(line['price_unit'] * line['quantity'])
            for candidate in candidate_vals_list:
                still_to_discount = abs(candidate['price_unit'] * candidate['quantity'] * (100.0 - candidate['discount']) / 100.0)
                if line_to_discount >= still_to_discount:
                    candidate['discount'] = 100.0
                    line_to_discount -= still_to_discount
                else:
                    rest_to_discount = abs((line_to_discount / (candidate['price_unit'] * candidate['quantity'])) * 100.0)
                    candidate['discount'] += rest_to_discount
                    break

        return filter(lambda l: l['price_unit'] * l['quantity'] > 0.0, lines)

    def _l10n_ke_edi_copycat_prepare_line_values(self, lines):

        tax_percentage_dict = {
            16.0: 'A',
            8.0: 'B',
            0.0: 'C',
        }

        # TODO: need to be able to construct the global discount thingie

        line_dicts = []
        for l in lines:
            line = l['line']
            percentage = line.tax_ids[0].amount
            letter = tax_percentage_dict.get(percentage, 'D')
            uom = line.product_uom_id and line.product_uom_id.name or ''
            invoice_line_dict = {
                'hsDesc': line.product_id.l10n_ke_hs_description or '', # TODO commodity codes etc
                'hsCode': line.product_id.l10n_ke_hs_code or '', # TODO commodity codes etc
                'namePLU': self._l10n_ke_remove_special_chars(line.name)[:38],
                'taxRate': percentage,
                'unitPrice': json_float_round(l['price_unit'], 2), #TODO: check
                'discount': l['discount'],
                'quantity': l['quantity'],
                'measureUnit': uom,
                'vatClass': letter,
            }
            line_dicts.append(invoice_line_dict)

        return line_dicts

    def _l10n_ke_edi_copycat_prepare_export_values(self):
        # Map from odoo type to type recoginised by the copycat edi system
        invoice_type_dict = {
            'out_invoice': 'tax_invoice',
            'out_refund': 'credit_note_item',
        }
        invoice_dict = {
            'senderId': self.company_id.l10n_ke_device_sender_id,
            'invoiceCategory': invoice_type_dict.get(self.move_type),
            'traderSystemInvoiceNumber': self._l10n_ke_remove_special_chars(self.name)[-15:],  # This field has a max length of 15
            'relevantInvoiceNumber': self.reversed_entry_id and self.reversed_entry_id.l10n_ke_middleware_number or "",
            'pinOfBuyer': self.partner_id.vat or "",
            'invoiceType': 'Original',
            'exemptionNumber': self.partner_id.l10n_ke_exemption_number or '',
            'totalInvoiceAmount': self.amount_total,
            'systemUser': self._l10n_ke_remove_special_chars(self.user_id.name or ''),
        }

        lines = self._l10n_ke_get_initial_lines_dict()
        lines = self._l10n_ke_global_discount_transform_dict(lines)
        invoice_lines = self._l10n_ke_edi_copycat_prepare_line_values(lines)
        invoice_dict.update({'deonItemDetails': invoice_lines})
        return json.dumps(invoice_dict)

    def l10n_ke_action_post_send_invoices(self):
        self.ensure_one()

        # Run configuration tests before sending the invoice
        errors = (
            self._l10n_ke_check_communication_configuration() +
            self._l10n_ke_check_move_configuration() +
            self._l10n_ke_check_move_lines_configuration()
        )
        if errors:
            error_title = _("Invalid configuration:")
            raise UserError(error_title + '\n' + '\n'.join(errors))

        self.l10n_ke_json_request = self._l10n_ke_edi_copycat_prepare_export_values()
        return {
            'type': 'ir.actions.client',
            'tag': 'action_post_send_invoice',
            'params': {
                'invoice': self.l10n_ke_json_request,
                'invoice_id': self.id,
                'device_proxy_url': self.company_id.l10n_ke_device_proxy_url,
                'device_url': self.company_id.l10n_ke_device_url,
                'access_token': self.company_id.l10n_ke_access_token,
            }
        }

    def l10n_ke_set_response_data(self, response):
        invoice = self.browse(int(response['invoice_id']))

        if response['invoiceType'] == 'DUPLICATE':
            invoice.message_post(body=_(
                "The invoice sent is a duplicate of an existing invoice"
                " on the system. The data associated with the original is"
                " applied to this invoice."
            ))

        invoice.update({
            'l10n_ke_control_unit_signing_datetime': fields.Datetime.now(),
            'l10n_ke_json_response': json.dumps(response),
        })
