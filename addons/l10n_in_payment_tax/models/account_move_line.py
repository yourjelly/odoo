# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import json

from odoo import api, fields, models, _, Command
from odoo.exceptions import UserError


class AccountMoveLine(models.Model):
    _inherit = "account.move.line"

    @api.model
    def _get_payment_tax_reverse_moves_line_vals(self, partial_line, payment_line_with_tax):
        line_vals = []
        sign = -1 if payment_line_with_tax.balance < 0 else 1
        compute_all_res = payment_line_with_tax.payment_id.l10n_in_tax_ids.compute_all(partial_line.amount, currency=partial_line.company_currency_id)
        for tax_res in compute_all_res['taxes']:
            amount = tax_res['amount'] * sign
            line_vals.append(Command.create({
                'name': tax_res['name'],
                'account_id': tax_res['account_id'],
                'partner_id': payment_line_with_tax.partner_id.id,
                'debit': amount if amount > 0.0 else 0.0,
                'credit': -amount if amount < 0.0 else 0.0,
                'tax_tag_ids': tax_res['tag_ids'],
                'tax_repartition_line_id': tax_res['tax_repartition_line_id'],
            }))
        total_tax_amount = (compute_all_res['total_included'] - compute_all_res['total_excluded']) * sign * -1
        line_vals.append(Command.create({
            'name': "Tax Adjustment Counter Part",
            'account_id': tax_res['account_id'],
            'partner_id': payment_line_with_tax.partner_id.id,
            'debit': total_tax_amount if total_tax_amount > 0.0 else 0.0,
            'credit': -total_tax_amount if total_tax_amount < 0.0 else 0.0,
        }))
        return line_vals

    @api.model
    def _get_payment_tax_reverse_moves_vals(self, partial_line, payment_line_with_tax):
        return {
            'move_type': 'entry',
            'ref': 'Advanced Payment Tax Adjustment agains reconcile of %s - %s'%(partial_line.credit_move_id.name, partial_line.debit_move_id.name),
            'journal_id': partial_line.company_id.account_advance_payment_tax_adjustment_journal_id.id
            'line_ids': _get_payment_tax_reverse_moves_line_vals(partial_line),
            'l10n_in_advanced_payment_tax_origin_move_id': payment_line_with_tax.payment_id.id,
        }

    def reconcile(self):
        result = super().reconcile()
        for line in result['partials']:
            reconcile_lines = line.credit_move_id + line.debit_move_id
            payment_line_with_tax = reconcile_lines.filtered(lambda l: l.payment_id.l10n_in_tax_ids and not sum(l.payment_id.l10n_in_tax_ids.flatten_taxes_hierarchy().mapped('amount')) < 0)
            reconcile_with_invoice_or_bill = reconcile_lines.filtered(lambda l: move_id.is_invoice(include_receipts=True)).move_id
            if payment_with_tax and reconcile_with_invoice_or_bill:
                result.setdefault('advanced_tax_adjustments', {})
                result['advanced_tax_adjustments'][line] = self.env['account.move'].create(_get_payment_tax_reverse_moves_vals(line, payment_line_with_tax))
        return result
            
