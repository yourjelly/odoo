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
        tax_ids = self.l10n_in_tax_ids
        if not tax_ids:
            return [], {}
        if not self.company_id.account_advance_payment_tax_account_id:
            raise UserError(_(
                "You can't set tax in payment without an advance payment tax account set on the configuration panel."))

        currency_id = self.currency_id.id
        tax_lines_vals = []
        counterpart_line_vals = {}
        base_amount = sum(self.line_ids.filtered(lambda l: l.account_id == self.outstanding_account_id).mapped('balance'))
        sign = 1 if base_amount < 0 else -1
        taxes_res = tax_ids.compute_all(base_amount, self.company_id.currency_id)
        total_tax_amount = 0.00
        for tax_res in taxes_res['taxes']:
            amount = tax_res['amount'] * sign
            total_tax_amount += amount
            tax_lines_vals.append({
                'name': tax_res['name'],
                'account_id': tax_res['account_id'],
                'partner_id': self.partner_id.id,
                'debit': amount if amount > 0.0 else 0.0,
                'credit': -amount if amount < 0.0 else 0.0,
                'tax_tag_ids': tax_res['tag_ids'],
                #'tax_repartition_line_id': tax_res['tax_repartition_line_id'],
            })
        if total_tax_amount:
            total_tax_amount = total_tax_amount * -1
            counterpart_line_vals = {
                'name': "Tax Counter Part",
                'date_maturity': self.date,
                'currency_id': currency_id,
                'debit': total_tax_amount if total_tax_amount > 0.0 else 0.0,
                'credit': -total_tax_amount if total_tax_amount < 0.0 else 0.0,
                'partner_id': self.partner_id.id,
                'account_id': self.company_id.account_advance_payment_tax_account_id.id,
            }
        return tax_lines_vals, counterpart_line_vals
        
    def _synchronize_to_moves(self, changed_fields):
        ''' Update the account.move regarding the modified account.payment.
        :param changed_fields: A list containing all modified fields on account.payment.
        '''
        super()._synchronize_to_moves(changed_fields)
        if self._context.get('skip_account_move_synchronization'):
            return

        if not any(field_name in changed_fields for field_name in self._get_trigger_fields_to_synchronize() + ('l10n_in_tax_ids',)):
            return

        for pay in self.with_context(skip_account_move_synchronization=True):
            tax_lines_vals, counterpart_line_vals = pay._prepare_move_line_tax_default_vals()
            tax_lines = pay.move_id.line_ids.filtered(lambda l: l.tax_line_id)
            line_ids_commands = []
            counterpart_line = pay.move_id.line_ids.filtered(lambda l: l.account_id == self.company_id.account_advance_payment_tax_account_id)
            payable_line = pay.move_id.line_ids.filtered(lambda l: l.account_id == pay.destination_account_id)
            #line_ids_commands.append(Command.update(payable_line.id, {'tax_ids': pay.l10n_in_tax_ids.ids or False}))
            if counterpart_line_vals:
                line_ids_commands.append(Command.update(counterpart_line.id, counterpart_line_vals) if counterpart_line else Command.create(counterpart_line_vals))
            elif counterpart_line:
                line_ids_commands.append(Command.delete(counterpart_line.id))
            for index, tax_line in enumerate(tax_lines):
                if len(tax_lines_vals) > index:
                    line_ids_commands.append(Command.update(tax_line.id, tax_lines_vals.pop(index)))
                else:
                    line_ids_commands.append(Command.delete(tax_line.id))
            for tax_line_vals in tax_lines_vals:
                line_ids_commands.append(Command.create(tax_line_vals))
            print(line_ids_commands)
            pay.move_id.write({
                'line_ids': line_ids_commands,
            })

    # def _synchronize_from_moves(self, changed_fields):
    #     ''' Update the account.payment regarding its related account.move.
    #     Also, check both models are still consistent.
    #     :param changed_fields: A set containing all modified fields on account.move.
    #     '''
    #     super()._synchronize_from_moves(changed_fields)
    #     if self._context.get('skip_account_move_synchronization'):
    #         return

    #     for pay in self.with_context(skip_account_move_synchronization=True):

    #         # After the migration to 14.0, the journal entry could be shared between the account.payment and the
    #         # account.bank.statement.line. In that case, the synchronization will only be made with the statement line.
    #         if pay.move_id.statement_line_id:
    #             continue
    #         move = pay.move_id
    #         move_vals_to_write = {}
    #         payment_vals_to_write = {}
    #         if 'line_ids' in changed_fields:
    #             # payable_line = move.line_ids.filtered(lambda l: l.account_id == pay.destination_account_id)
    #             # payment_vals_to_write.update({'l10n_in_tax_ids': payable_line.tax_ids.ids or False})
    #             counterpart_line = move.line_ids.filtered(lambda l: l.account_id == pay.company_id.account_advance_payment_tax_account_id)
    #             tax_lines_vals, counterpart_line_vals = self._prepare_move_line_tax_counterpart_default_vals()
    #             line_ids_command = []
    #             if counterpart_line:
    #                 line_ids_command.append(Command.update(counterpart_line.id, counterpart_line_vals))
    #             elif pay.l10n_in_tax_ids:
    #                 line_ids_command.append(Command.create(counterpart_line_vals))
    #             for index, tax_line in enumerate(tax_lines):
    #                 if len(tax_lines_vals) > index:
    #                     line_ids_commands.append(Command.update(tax_line.id, tax_lines_vals.pop(index)))
    #                 else:
    #                     line_ids_commands.append(Command.delete(tax_line.id))
    #             for tax_line_vals in tax_lines_vals:
    #                 line_ids_commands.append(Command.create(tax_line_vals))
    #                 move_vals_to_write.update({'line_ids': line_ids_command})
    #         move.write(move._cleanup_write_orm_values(move, move_vals_to_write))
    #         pay.write(move._cleanup_write_orm_values(pay, payment_vals_to_write))

    def _seek_for_lines(self):
        liquidity_lines, counterpart_lines, writeoff_lines = super()._seek_for_lines()
        if self.l10n_in_tax_ids:
            # other lines is not writeoff line so, ignore if tax is set
            #writeoff_lines = self.env['account.move.line']
            advance_payment_tax_account_id = self.company_id.account_advance_payment_tax_account_id
            print("Before--------------",writeoff_lines)
            writeoff_lines = writeoff_lines.filtered(lambda l: not (l.account_id == advance_payment_tax_account_id or l.tax_repartition_line_id))
            print("After--------------",writeoff_lines)
        return liquidity_lines, counterpart_lines, writeoff_lines
