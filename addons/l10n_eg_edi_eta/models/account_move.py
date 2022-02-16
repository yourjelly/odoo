# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.


import base64
from collections import defaultdict

from odoo import models, fields, api, _
from odoo.exceptions import ValidationError
import logging

from odoo.tools import formatLang

_logger = logging.getLogger(__name__)


class AccountMove(models.Model):
    _inherit = 'account.move'

    l10n_eg_invoice_signed = fields.Boolean('Document Signed', copy=False, tracking=True)

    l10n_eg_branch_id = fields.Many2one('res.partner', string='Branch', copy=False)

    l10n_eg_long_id = fields.Char('ETA Long ID', copy=False)
    l10n_eg_internal_id = fields.Char('ETA Internal ID', copy=False)
    l10n_eg_hash_key = fields.Char('ETA Hash Key', copy=False)
    l10n_eg_uuid = fields.Char(string='Document UUID', copy=False)
    l10n_eg_submission_id = fields.Char(string='Submission ID', copy=False)
    l10n_eg_signature_type = fields.Char(string='Signature Type', copy=False)

    l10n_eg_signature_data = fields.Text('Signature Data', copy=False)

    l10n_eg_posted_datetime = fields.Datetime('Posted Date', copy=False)

    l10n_eg_pdf = fields.Binary(string='ETA PDF Document', copy=False)
    l10n_eg_amount_by_group = fields.Binary(string="Tax amount by group",
                                            compute='_compute_invoice_taxes_by_group_l10n_eg',
                                            help='Edit Tax amounts if you encounter rounding issues.')

    l10n_eg_total_discount = fields.Monetary(compute='_compute_amount_discounts')
    l10n_eg_total_without_discount = fields.Monetary(compute='_compute_amount_discounts')

    @api.depends('invoice_line_ids.quantity', 'invoice_line_ids.price_unit', 'amount_untaxed')
    def _compute_amount_discounts(self):
        for move in self:
            total = sum([line.quantity * line.price_unit for line in move.invoice_line_ids])
            move.l10n_eg_total_without_discount = total
            move.l10n_eg_total_discount = total - move.amount_untaxed

    @api.depends('line_ids.price_subtotal', 'line_ids.tax_base_amount', 'line_ids.tax_line_id', 'partner_id', 'currency_id')
    def _compute_invoice_taxes_by_group_l10n_eg(self):
        for move in self:

            # Not working on something else than invoices.
            if not move.is_invoice(include_receipts=True):
                move.l10n_eg_amount_by_group = []
                continue

            lang_env = move.with_context(lang=move.partner_id.lang).env
            balance_multiplicator = -1 if move.is_inbound() else 1

            tax_lines = move.line_ids.filtered('tax_line_id')
            base_lines = move.line_ids.filtered('tax_ids')

            tax_group_mapping = defaultdict(lambda: {
                'base_lines': set(),
                'base_amount': 0.0,
                'tax_amount': 0.0,
            })

            # Compute base amounts.
            for base_line in base_lines:
                base_amount = balance_multiplicator * (base_line.amount_currency if base_line.currency_id else base_line.balance)

                for tax in base_line.tax_ids.flatten_taxes_hierarchy():

                    if base_line.tax_line_id.tax_group_id == tax.tax_group_id:
                        continue

                    tax_group_vals = tax_group_mapping[tax.tax_group_id]
                    if base_line not in tax_group_vals['base_lines']:
                        tax_group_vals['base_amount'] += base_amount
                        tax_group_vals['base_lines'].add(base_line)

            # Compute tax amounts.
            for tax_line in tax_lines:
                tax_amount = balance_multiplicator * (tax_line.amount_currency if tax_line.currency_id else tax_line.balance)
                tax_group_vals = tax_group_mapping[tax_line.tax_line_id.tax_group_id]
                tax_group_vals['tax_amount'] += tax_amount

            tax_groups = sorted(tax_group_mapping.keys(), key=lambda x: x.sequence)
            l10n_eg_amount_by_group = []
            for tax_group in tax_groups:
                tax_group_vals = tax_group_mapping[tax_group]
                l10n_eg_amount_by_group.append((
                    tax_group.name,
                    tax_group_vals['tax_amount'],
                    tax_group_vals['base_amount'],
                    formatLang(lang_env, tax_group_vals['tax_amount'], currency_obj=move.currency_id),
                    formatLang(lang_env, tax_group_vals['base_amount'], currency_obj=move.currency_id),
                    len(tax_group_mapping),
                    tax_group.id
                ))
            move.l10n_eg_amount_by_group = l10n_eg_amount_by_group

    def action_post(self):
        res = super().action_post()
        self.filtered(lambda r: r.country_code == 'EG' and r.move_type in ('out_invoice', 'out_refund') and not r.l10n_eg_posted_datetime and r.state == 'posted').write({
            'l10n_eg_posted_datetime': fields.Datetime.now()
        })
        return res

    def action_post_sign_invoice(self):
        # TODO return a wizard with the json invoice
        self.ensure_one()
        sign_host = self.env['ir.config_parameter'].sudo().get_param('default.sign.host')
        if not sign_host:
            raise ValidationError(_('Please define the host of sign toll.'))
        eta_invoice = self.env['account.edi.format']._l10n_eg_eta_prepare_eta_invoice(self)
        eta_invoice.pop('signatures', None)
        return {
            'type': 'ir.actions.client',
            'tag': 'action_post_sign_invoice',
            'params': {
                'invoice_id': self.id,
                'sign_host': sign_host,
                'eta_invoice': eta_invoice
            }
        }

    def action_get_eta_invoice_pdf(self, token=False, uuid=False):
        self.ensure_one()
        if not uuid:
            uuid = self.l10n_eg_uuid
        invoice = self.env['account.edi.format']._l10n_eg_get_eta_invoice_pdf(uuid, token)
        if isinstance(invoice, dict) and invoice.get('error', False):
            _logger.warning('PDF Content Error:  %s.' % invoice.get('error'))
        else:
            pdf = base64.b64encode(invoice)
            self.l10n_eg_pdf = pdf
            self.l10n_eg_document_name = "%s.pdf" % self.name.replace('/', '_')

    def _get_amount_main_currency(self, amount):
        from_currency = self.currency_id
        to_currency = self.company_id.currency_id
        new_amount = amount
        if from_currency != to_currency:
            new_amount = from_currency._convert(
                from_amount=amount,
                to_currency=to_currency,
                company=self.company_id,
                date=fields.Date.today(),
                round=False)
        return to_currency.round(new_amount)

    def _exchange_currency_rate(self):
        from_currency = self.currency_id
        to_currency = self.company_id.currency_id
        company = self.company_id
        rate = 1.0
        if from_currency != to_currency:
            rate = self.env['res.currency']._get_conversion_rate(from_currency, to_currency, company,
                                                                 self.invoice_date)
        return to_currency.round(rate)
