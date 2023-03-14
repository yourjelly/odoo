# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import json

from odoo import api, fields, models, _, Command
from odoo.exceptions import UserError


class AccountPayment(models.Model):
    _inherit = "account.payment"

    l10n_in_tax_ids = fields.Many2many('account.tax', string="Taxes")

    def _prepare_move_line_tax_default_vals(self):
        self.ensure_one()
        currency_id = self.currency_id.id
        lines_vals = []
        counterpart_vals = []
        # TODO convert to company currency 
        liquidity_balance = self.currency_id._convert(
            self.amount,
            self.company_id.currency_id,
            self.company_id,
            self.date,
        )
        sign = -1 if self.payment_type == 'outbound' else 1
        taxes_res = self.l10n_in_tax_ids.compute_all(liquidity_balance, self.company_id.currency_id)
        total_tax_amount = 0.00
        counterpart_account_id = self.company_id.account_advance_payment_tax_account_id.id,
        for tax_res in taxes_res['taxes']:
            amount = tax_res['amount'] * sign * -1
            total_tax_amount += tax_res['amount']
            lines_vals.append({
                'name': tax_res['name'],
                'account_id': tax_res['account_id'],
                'partner_id': self.partner_id.id,
                'debit': amount if amount > 0.0 else 0.0,
                'credit': -amount if amount < 0.0 else 0.0,
                'tax_tag_ids': tax_res['tag_ids'],
                'is_advance_payment_line': True,
                'display_type': 'advance_tax'
            })
            tax = self.env['account.tax'].browse(tax_res['id'])
            if tax.amount < 0:
                lines_vals.append({
                    'name': _("Reduce %s becosue of negative tax %s", self.outstanding_account_id.name, tax_res['name']),
                    'account_id': self.outstanding_account_id.id,
                    'partner_id': self.partner_id.id,
                    'debit': -amount if amount < 0.0 else 0.0,
                    'credit': amount if amount > 0.0 else 0.0,
                    'is_advance_payment_line': True,
                    'display_type': 'advance_tax'
                })
                lines_vals.append({
                    'name': _("Reduce %s becosue of negative tax %s", self.destination_account_id.name, tax_res['name']),
                    'account_id': self.destination_account_id.id,
                    'partner_id': self.partner_id.id,
                    'debit': amount if amount > 0.0 else 0.0,
                    'credit': -amount if amount < 0.0 else 0.0,
                    'is_advance_payment_line': True,
                    'display_type': 'advance_tax'
                })
        if total_tax_amount:
            total_tax_amount = total_tax_amount * sign
            counterpart_vals.append({
                'name': "Tax Counter Part",
                'date_maturity': self.date,
                'currency_id': currency_id,
                'debit': total_tax_amount if total_tax_amount > 0.0 else 0.0,
                'credit': -total_tax_amount if total_tax_amount < 0.0 else 0.0,
                'partner_id': self.partner_id.id,
                'account_id': counterpart_account_id,
                'is_advance_payment_line': True,
                'display_type': 'advance_tax'
            })
        return lines_vals , counterpart_vals

    def _prepare_move_line_default_vals(self, write_off_line_vals=None):
        res = super()._prepare_move_line_default_vals(write_off_line_vals)
        # handel by _synchronize_to_moves if this context found
        if self._context.get('skip_account_move_synchronization'):
            return res
        if self.l10n_in_tax_ids:
            if not self.company_id.account_advance_payment_tax_account_id:
                raise UserError(_(
                    "You can't set tax in payment without an advance payment tax account set on the configuration panel."))
            lines_vals , counterpart_vals = self._prepare_move_line_tax_default_vals()
            return res + lines_vals + counterpart_vals
        return res

    def _synchronize_to_moves(self, changed_fields):
        ''' Update the account.move regarding the modified account.payment.
        :param changed_fields: A list containing all modified fields on account.payment.
        '''
        super()._synchronize_to_moves(changed_fields)
        if self._context.get('skip_account_move_synchronization'):
            return

        if not any(field_name in changed_fields for field_name in self._get_trigger_fields_to_synchronize() + ('l10n_in_tax_ids',)):
            return

        if not self.company_id.account_advance_payment_tax_account_id:
            raise UserError(_(
                "You can't set tax in payment without an advance payment tax account set on the configuration panel."))

        for pay in self.with_context(skip_account_move_synchronization=True):
            line_ids_commands = []
            tax_lines_vals, counterpart_vals = pay._prepare_move_line_tax_default_vals()
            tax_counterpart_line = pay.move_id.line_ids.filtered(lambda l: l.account_id == self.company_id.account_advance_payment_tax_account_id)
            tax_lines = pay.move_id.line_ids.filtered(lambda l: l.display_type == 'advance_tax') - tax_counterpart_line
            if counterpart_vals:
                line_ids_commands.append(Command.update(tax_counterpart_line.id, counterpart_vals[0]) if tax_counterpart_line else Command.create(counterpart_vals[0]))
            elif tax_counterpart_line:
                line_ids_commands.append(Command.delete(tax_counterpart_line.id))
            for index, tax_line in enumerate(tax_lines):
                if len(tax_lines_vals) > index:
                    line_ids_commands.append(Command.update(tax_line.id, tax_lines_vals.pop(index)))
                else:
                    line_ids_commands.append(Command.delete(tax_line.id))
            for tax_line_vals in tax_lines_vals:
                line_ids_commands.append(Command.create(tax_line_vals))
            pay.move_id.write({
                'line_ids': line_ids_commands,
            })

    def _synchronize_from_moves(self, changed_fields):
        if self._context.get('skip_account_move_synchronization') or 'is_payment' in self._context:
            return
        if 'line_ids' in changed_fields:
            for pay in self:
                if pay.l10n_in_tax_ids:
                    raise UserError(_("You can't edit lines when tax is selected on the payment"))
        return super()._synchronize_from_moves(changed_fields)

    def _seek_for_lines(self):
        liquidity_lines, counterpart_lines, writeoff_lines = super()._seek_for_lines()
        if self.l10n_in_tax_ids:
            writeoff_lines = writeoff_lines.filtered(lambda l: not l.display_type == 'advance_tax')
            liquidity_lines = liquidity_lines.filtered(lambda l: not l.display_type == 'advance_tax')
            counterpart_lines = counterpart_lines.filtered(lambda l: not l.display_type == 'advance_tax')
        return liquidity_lines, counterpart_lines, writeoff_lines
