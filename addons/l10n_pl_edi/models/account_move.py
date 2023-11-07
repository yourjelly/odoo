# -*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
import pytz

from datetime import datetime
from lxml import etree

from odoo import api, fields, models, _
from odoo.tools import cleanup_xml_node, float_is_zero, float_repr

DEFAULT_PL_EINVOICE_DATETIME_FORMAT = '%Y-%m-%dT%H:%M:%SZ'


class AccountMove(models.Model):
    _inherit = 'account.move'

    l10n_pl_edi_ksef_xml_id = fields.Many2one(
        comodel_name='ir.attachment',
        string="Ksef Attachment",
        compute=lambda self: self._compute_linked_attachment_id('l10n_pl_edi_ksef_xml_id', 'l10n_pl_edi_ksef_xml_file'),
        depends=['l10n_pl_edi_ksef_xml_file']
    )
    l10n_pl_edi_ksef_xml_file = fields.Binary(
        attachment=True,
        string="Ksef File",
        copy=False,
    )

    def _check_mandatory_fields(self):
        errors = []
        company = self.company_id
        if not company.vat:
            errors.append(_("You must have a VAT number to be able to issue e-invoices\n"))
        if not company.country_id or not company.street and not company.city and not company.zip:
            errors.append(_("Please complete the address of your company\n"))
        return errors

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
                oss_tag = self.env['account.account.tag'].search([('name', '=', 'OSS'), ('applicability', '=', 'taxes')]) # or do self.env.ref('l10n_eu_oss.tag_oss') but check if installed
                return - sum(
                    self.line_ids.filtered(lambda line: any(tag in oss_tag for tag in line.tax_tag_ids) and (
                        line.tax_ids if 'Base in tax_tag_string' else not line.tax_ids
                    )).mapped('amount_currency'))
            else:
                tax_tags = self.env['account.account.tag']._get_tax_tags(tax_tag_string, self.env.ref('base.pl').id)
                return - sum(self.line_ids.filtered(lambda line: any(tag in tax_tags for tag in line.tax_tag_ids)).mapped('amount_currency'))

        def get_amounts_from_tag_in_PLN_currency(tax_group_id):
            conversion_line = self.invoice_line_ids.sorted(lambda l: abs(l.balance), reverse=True)[0] if self.invoice_line_ids else None
            conversion_rate = abs(conversion_line.balance / conversion_line.amount_currency) if self.currency_id != polish_currency and conversion_line else 1

            tax_amount_currency = get_amounts_from_tag(tax_group_id) * conversion_rate
            return tax_amount_currency

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
        }
        return template_values

    def _l10n_pl_edi_render_xml(self):
        vals = self._prepare_pl_einvoice_export_values()
        errors = self._check_mandatory_fields()
        xml_content = self.env['ir.qweb']._render('l10n_pl_edi.account_invoice_pl_ksef_export', vals)
        return etree.tostring(cleanup_xml_node(xml_content), xml_declaration=True, encoding='UTF-8'), set(errors)

    def _l10n_pl_edi_ksef_get_default_enable(self):
        self.ensure_one()
        return (
            not self.invoice_pdf_report_id
            and not self.l10n_pl_edi_ksef_xml_id
            and self.is_invoice(include_receipts=True)
            and self.company_id.account_fiscal_country_id.code == 'PL'  # TODO check what condition here?
        )

    def _l10n_pl_edi_ksef_get_filename(self):
        self.ensure_one()
        return f'{self.name.replace("/", "_")}_ksef.xml'
