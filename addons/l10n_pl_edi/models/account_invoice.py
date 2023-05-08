# -*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
import pytz
import re

from datetime import datetime

from odoo import api, fields, models, _
from odoo.exceptions import UserError, ValidationError
from odoo.tools import float_is_zero, float_repr
from odoo.tools.misc import street_split
from odoo.addons.base_iban.models.res_partner_bank import validate_iban

_logger = logging.getLogger(__name__)

DEFAULT_PL_EINVOICE_DATE_FORMAT = '%Y-%m-%d'
DEFAULT_PL_EINVOICE_DATETIME_FORMAT = '%Y-%m-%dT%H:%M:%SZ'


class AccountMove(models.Model):
    _inherit = 'account.move'

    l10n_pl_edi_attachment_id = fields.Many2one('ir.attachment', copy=False, string="KSeF Attachment", ondelete="restrict")

    def _check_mandatory_fields(self):
        company = self.company_id
        if not self.company_id.vat:
            raise UserError(_("You must have a VAT number to be able to issue e-invoices"))
        if not company.country_id or not company.street and not company.city and not company.zip:
            raise UserError(_("Please complete the address of your company"))

    def _prepare_pl_einvoice_export_values(self):

        def get_vat_number(vat):
            if vat[:2].isdecimal():
                return vat.replace(' ', '')
            return vat[2:].replace(' ', '')

        def get_vat_country(vat):
            if not vat or vat[:2].isdecimal():
                return False
            return vat[:2].upper()

        def get_amounts_from_tag(tax_tag_string):
            if 'OSS' in tax_tag_string:
                v = self.env['account.account.tag'].search([('name', '=', 'OSS'), ('applicability', '=', 'taxes')]) # or do self.env.ref('l10n_eu_oss.tag_oss') but check if installed
                if 'Base' in tax_tag_string:
                    return - sum(self.line_ids.filtered(lambda l: any(tag in v for tag in l.tax_tag_ids) and l.tax_ids).mapped('amount_currency'))
                else:
                    return - sum(self.line_ids.filtered(
                        lambda l: any(tag in v for tag in l.tax_tag_ids) and not l.tax_ids).mapped('amount_currency'))
            else:
                v = self.env['account.account.tag']._get_tax_tags(tax_tag_string, self.env.ref('base.pl').id)
                return - sum(self.line_ids.filtered(lambda l: any(tag in v for tag in l.tax_tag_ids)).mapped('amount_currency'))

        def get_amounts_from_tag_in_PLN_currency(tax_group_id):
            conversion_line = self.invoice_line_ids.sorted(lambda l: abs(l.balance), reverse=True)[
                0] if self.invoice_line_ids else None
            conversion_rate = abs(conversion_line.balance / conversion_line.amount_currency) if self.currency_id != polish_currency and conversion_line else 1

            tax_amount_currency = get_amounts_from_tag(tax_group_id) * conversion_rate
            return tax_amount_currency

        def _get_account_number_NRB(self):
            if self.get_partner_id.acc_number[0:2] == 'PL':
                try:
                    validate_iban(self.partner_bank_id.acc_number)
                    return self.partner_bank_id.acc_number[2:]
                except Exception:
                    return False
            else:
                try:
                    validate_iban(f"'PL'{self.partner_bank_id.acc_number}")
                    return self.partner_bank_id.acc_number
                except Exception:
                    return False

        self._check_mandatory_fields()

        polish_currency = self.env.ref('base.PLN')

        template_values = {
            'record': self,
            'date_now': datetime.strftime(pytz.utc.localize(fields.Datetime.now()), DEFAULT_PL_EINVOICE_DATETIME_FORMAT),
            'company': self.env.company,
            'buyer': self.partner_id,
            'get_vat_number': get_vat_number,
            'get_vat_country': get_vat_country,
            'get_amounts_from_tag': get_amounts_from_tag,
            'get_amounts_from_tag_in_PLN_currency': get_amounts_from_tag_in_PLN_currency,
            'float_repr': float_repr,
            'float_is_zero': float_is_zero,
            'date_today': fields.Date.today(),
            '_get_account_number_NRB': _get_account_number_NRB,
        }
        return template_values
