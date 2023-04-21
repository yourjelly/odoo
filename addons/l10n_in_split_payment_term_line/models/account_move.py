# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields
from odoo.tools import frozendict


class AccountMove(models.Model):
    _inherit = "account.move"

    def _post(self, soft=True):
        super()._post(soft)
        for move in self:
            lines = move.line_ids.filtered(lambda l: l.display_type == 'payment_term')
            lines.reconcile()

    def _get_all_reconciled_invoice_partials(self):
        partial_values_list = super()._get_all_reconciled_invoice_partials()
        for partial_values in partial_values_list.copy():
            if partial_values['aml'].move_id == self:
                partial_values_list.remove(partial_values)
        return partial_values_list

    def _compute_needed_terms(self):
        super()._compute_needed_terms()
        for invoice in self.filtered(lambda m: sum(m.line_ids.tax_ids.mapped('amount')) < 0):
            if invoice.needed_terms:
                needed_term_key, needed_term_value = [(a, b) for a, b in invoice.needed_terms.items()][0]
                key = frozendict({
                    'move_id': invoice.id,
                    'date_maturity': needed_term_key['date_maturity'],
                    'discount_date': needed_term_key['discount_date'],
                    'discount_percentage': needed_term_key['discount_percentage'],
                    'is_tds_line': False
                })
                key_2 = frozendict({
                    'move_id': invoice.id,
                    'date_maturity': needed_term_key['date_maturity'],
                    'discount_date': needed_term_key['discount_date'],
                    'discount_percentage': needed_term_key['discount_percentage'],
                    'is_tds_line': True
                })
                tds_lines = invoice.line_ids.filtered(lambda l: l.tax_line_id.amount < 0)
                invoice.needed_terms = {
                    key: {
                        **needed_term_value,
                        'balance': needed_term_value['balance'] + sum(tds_lines.mapped('balance')),
                        'amount_currency': needed_term_value['amount_currency'] + sum(tds_lines.mapped('amount_currency')),
                    }
                }
                if tds_lines:
                    invoice.needed_terms.update({
                    key_2: {
                        'balance': - sum(tds_lines.mapped('balance')),
                        'amount_currency': - sum(tds_lines.mapped('amount_currency')),
                        'discount_amount_currency': 0.0,
                        'discount_balance': 0.0,
                        'discount_date': needed_term_key['discount_date'],
                        'discount_percentage': 0.00,
                    }})


class AccountMoveLine(models.Model):
    _inherit = "account.move.line"

    is_tds_line = fields.Boolean(default=False, copy=False)

    def _compute_term_key(self):
        super()._compute_term_key()
        for line in self:
            if line.display_type == 'payment_term':
                line.term_key = frozendict({
                    'move_id': line.move_id.id,
                    'date_maturity': fields.Date.to_date(line.date_maturity),
                    'discount_date': line.discount_date,
                    'discount_percentage': line.discount_percentage,
                    'is_tds_line': line.is_tds_line,
                })
