# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.


import json
import logging
import requests
from werkzeug.urls import url_quote
from base64 import b64encode

from odoo import api, models, _
from odoo.tools.float_utils import json_float_round

_logger = logging.getLogger(__name__)


class AccountEdiFormat(models.Model):
    _inherit = 'account.edi.format'

    def _l10n_ke_tims_prepare_invoice(self, invoice):
        # TODO: make sure passed fields are cleaned out -> need to remove all non-alphanumeric chars probably
        def remove_special_chars(name):
            pass

        perc_dict = {16.0: 'A',
                     8.0: 'B',
                     0.0: 'C'}
        # Let's try to assemble all the info we need for this invoice
        invoice_dict = {'company_name': invoice.company_id.name,
                        'invoice_name': invoice.name.strip("/"),
                        'invoice_type': invoice.move_type, # TODO: add support for debit notes or check if needed
                        'company_pin': invoice.company_id.vat,
                        'buyer_pin': invoice.partner_id.vat,
                        'partner_name': (invoice.commercial_partner_id.name)[:30],
                        'partner_addr': ((invoice.partner_id.street or '') + (invoice.partner_id.street2 or ''))[:30],
                        'partner_zip': (invoice.partner_id.zip + invoice.partner_id.city)[:30],
                        'server': invoice.company_id.l10n_ke_url,
                        }
        invoice_lines = []
        for invoice_line in invoice.invoice_line_ids.filtered(lambda l: not l.display_type):
            percentage = invoice_line.tax_ids[0].amount
            letter = perc_dict.get(percentage, 'D')
            uom = invoice_line.product_uom_id and invoice_line.product_uom_id.name[:3] or 'UNI' #TODO: check UNI
            invoice_line_dict = {
                'vat_class': letter,
                'name': invoice_line.name,
                'price': invoice_line.price_unit,
                'uom': uom,
                'quantity': invoice_line.quantity,
                'discount': invoice_line.discount,
            }
            if letter != 'A':
                invoice_line_dict.update({'hscode': invoice_line.product_id.l10n_ke_hsn_code,
                                          'hsname': invoice_line.product_id.l10n_ke_hsn_name})
            invoice_lines.append(invoice_line_dict)
        invoice_dict.update({'invoice_lines': invoice_lines})
        return json.dumps({invoice.id: invoice_dict})

    # -------------------------------------------------------------------------
    # EDI OVERRIDDEN METHODS
    # -------------------------------------------------------------------------

    def _needs_web_services(self):
        return self.code == 'ke_tims' or super()._needs_web_services()

    def _check_move_configuration(self, invoice):
        errors = super()._check_move_configuration(invoice)
        if self.code != 'ke_tims':
            return errors
        return errors

    def _post_invoice_edi(self, invoices):
        if self.code != 'ke_tims':
            return super()._post_invoice_edi(invoices)
        invoice = invoices  # Batching is disabled for this EDI.

        # In case we have already sent it, but have not got a final answer yet.
        if invoice.l10n_ke_qrcode:
            return {invoice: self._l10n_eg_get_einvoice_status(invoice)}

        if not invoice.l10n_ke_qrcode:
            return {
                invoice: {
                    'error':  _("You should send the invoice to the device through the dedicated page"),
                    'blocking_level': 'info'
                }
            }
        else:
            # Create the new attachment for the file
            attachment = self.env['ir.attachment'].create({
                'name': 'dump.json',
                'raw': invoice.l10n_ke_json,
                'res_model': 'account.move',
                'res_id': invoice.id,
                'type': 'binary'})
            invoice.l10n_ke_json = False
            return {invoice: {'success': True,
                              'attachment': attachment}}

    def _get_invoice_edi_content(self, move):
        if self.code != 'ke_tims':
            return super()._get_invoice_edi_content(move)
        return json.dumps(self._l10n_ke_tims_prepare_invoice(move)).encode()

    def _is_compatible_with_journal(self, journal):
        # OVERRIDE
        if self.code != 'ke_tims':
            return super()._is_compatible_with_journal(journal)
        return journal.country_code == 'KE' and journal.type == 'sale'
