# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import json

from odoo import api, fields, models, _, Command
from odoo.exceptions import UserError


class AccountPayment(models.Model):
    _inherit = "account.payment"

    # @api.depends('amount_total_signed', 'payment_type')
    # def _compute_amount_company_currency_signed(self):
    #     super()._compute_amount_company_currency_signed()
    #     payment_with_negative_tax = self.filtered(lambda p: p.l10n_in_tax_ids and sum(p.l10n_in_tax_ids.mapped('amount')) < 0)
    #     for payment in payment_with_negative_tax:
    #         tax_counterpart_line = payment.move_id.line_ids.filtered(lambda l: l.account_id == payment.company_id.account_advance_payment_tax_account_id)
    #         payment.amount_company_currency_signed += sum(tax_counterpart_line.mapped('balance'))

    l10n_in_tax_ids = fields.Many2many('account.tax', string="Taxes")

    def _prepare_move_line_tax_default_vals(self):
        self.ensure_one()
        currency_id = self.currency_id.id
        lines_vals = []
        #counterpart_line_vals = {}
        # TODO convert to company currency 
        base_amount = self.amount
        sign = -1 if self.payment_type == 'outbound' else 1
        taxes_res = self.l10n_in_tax_ids.compute_all(base_amount, self.company_id.currency_id)
        total_tax_amount = 0.00
        is_negative_tax = self.filtered(lambda p: p.l10n_in_tax_ids and sum(p.l10n_in_tax_ids.mapped('amount')) < 0)
        counterpart_account_id = self.company_id.account_advance_payment_tax_account_id.id,
        if is_negative_tax:
            counterpart_account_id = self.outstanding_account_id.id
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
                #'tax_repartition_line_id': tax_res['tax_repartition_line_id'],
            })
        if total_tax_amount:
            total_tax_amount = total_tax_amount * sign
            lines_vals.append({
                'name': "Tax Counter Part",
                'date_maturity': self.date,
                'currency_id': currency_id,
                'debit': total_tax_amount if total_tax_amount > 0.0 else 0.0,
                'credit': -total_tax_amount if total_tax_amount < 0.0 else 0.0,
                'partner_id': self.partner_id.id,
                'account_id': counterpart_account_id,
            })
        print(lines_vals)
        return lines_vals #, counterpart_line_vals

    # def _synchronize_to_moves(self, changed_fields):
    #     ''' Update the account.move regarding the modified account.payment.
    #     :param changed_fields: A list containing all modified fields on account.payment.
    #     '''
    #     super()._synchronize_to_moves(changed_fields)
    #     if self._context.get('skip_account_move_synchronization'):
    #         return

    #     if not any(field_name in changed_fields for field_name in self._get_trigger_fields_to_synchronize() + ('l10n_in_tax_ids',)):
    #         return

    #     for pay in self.with_context(skip_account_move_synchronization=True):
    #         line_ids_commands = []

    #         liquidity_lines, counterpart_lines, writeoff_lines = pay._seek_for_lines()
    #         tax_lines_vals, tax_counterpart_line_vals = pay._prepare_move_line_tax_default_vals()
    #         tax_lines = pay.move_id.line_ids.filtered(lambda l: l.tax_line_id)
    #         tax_counterpart_line = pay.move_id.line_ids.filtered(lambda l: l.account_id == self.company_id.account_advance_payment_tax_account_id)
    #         #line_ids_commands.append(Command.update(counterpart_lines.id, {'tax_ids': pay.l10n_in_tax_ids.ids or False}))
    #         # TODO convert to company currency 
    #         base_amount = self.amount
    #         is_negative_tax = pay.filtered(lambda p: p.l10n_in_tax_ids and sum(p.l10n_in_tax_ids.mapped('amount')) < 0)
    #         if is_negative_tax:
    #             if tax_counterpart_line_vals['credit']:
    #                 line_ids_commands.append(Command.update(liquidity_lines.id, {'debit': base_amount - tax_counterpart_line_vals['credit']}))
    #                 line_ids_commands.append(Command.update(counterpart_lines.id, {'credit': base_amount - tax_counterpart_line_vals['credit']}))
    #             if tax_counterpart_line_vals['debit']:
    #                 line_ids_commands.append(Command.update(liquidity_lines.id, {'credit': base_amount - tax_counterpart_line_vals['debit']}))
    #                 line_ids_commands.append(Command.update(counterpart_lines.id, {'debit': base_amount - tax_counterpart_line_vals['debit']}))
    #         if tax_counterpart_line_vals:
    #             line_ids_commands.append(Command.update(tax_counterpart_line.id, tax_counterpart_line_vals) if tax_counterpart_line else Command.create(tax_counterpart_line_vals))
    #         elif tax_counterpart_line:
    #             line_ids_commands.append(Command.delete(tax_counterpart_line.id))
    #         for index, tax_line in enumerate(tax_lines):
    #             if len(tax_lines_vals) > index:
    #                 line_ids_commands.append(Command.update(tax_line.id, tax_lines_vals.pop(index)))
    #             else:
    #                 line_ids_commands.append(Command.delete(tax_line.id))
    #         for tax_line_vals in tax_lines_vals:
    #             line_ids_commands.append(Command.create(tax_line_vals))
    #         print(line_ids_commands)
    #         pay.move_id.write({
    #             'line_ids': line_ids_commands,
    #         })

    # def _synchronize_from_moves(self, changed_fields):
    #     if self._context.get('skip_account_move_synchronization'):
    #         return 
    #     if 'line_ids' in changed_fields:
    #         for pay in self:
    #             if pay.l10n_in_tax_ids:
    #                 raise UserError(_("You can't edit lines when tax is selected on the payment"))
    #     return super()._synchronize_from_moves(changed_fields)

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

    # def _seek_for_lines(self):
    #     liquidity_lines, counterpart_lines, writeoff_lines = super()._seek_for_lines()
    #     if self.l10n_in_tax_ids:
    #         # other lines is not writeoff line so, ignore if tax is set
    #         #writeoff_lines = self.env['account.move.line']
    #         #advance_payment_tax_account_id = self.company_id.account_advance_payment_tax_account_id
    #         print("Before--------------",writeoff_lines)
    #         #writeoff_lines = writeoff_lines.filtered(lambda l: not (l.account_id == advance_payment_tax_account_id or l.tax_repartition_line_id))
    #         writeoff_lines = writeoff_lines.filtered(lambda l: not l.tax_tag_ids)
    #         print("After--------------",writeoff_lines)
    #     return liquidity_lines, counterpart_lines, writeoff_lines

    def _create_advanced_payment_tax_move(self):
        payment_with_tax = self.filtered(lambda p: p.l10n_in_tax_ids)
        for pay in payment_with_tax:
            if not pay.company_id.account_advance_payment_tax_account_id:
                raise UserError(_(
                    "You can't set tax in payment without an advance payment tax account set on the configuration panel."))
            if not pay.company_id.account_advance_payment_tax_adjustment_journal_id:
                raise UserError(_(
                    "You can't set tax in payment without an advance payment tax journal set on the configuration panel."))

            advanced_tax_line = pay.move_id.line_ids.filtered(lambda l: l.account_id == pay.company_id.account_advance_payment_tax_account_id)
            advanced_tax_amount = sum(advanced_tax_line.mapped('balance')) * -1
            name = "Advance - %s"%(", ".join(pay.l10n_in_tax_ids.mapped('name')))
            move = self.env['account.move'].create({
                'move_type': 'entry',
                'ref': name,
                'journal_id': pay.company_id.account_advance_payment_tax_adjustment_journal_id.id,
                'l10n_in_advanced_payment_tax_origin_move_id': pay.move_id.id,
                'line_ids': [Command.create(line) for line in pay._prepare_move_line_tax_default_vals()]
            })
            move.action_post()
            is_negative_tax = pay.filtered(lambda p: p.l10n_in_tax_ids and sum(p.l10n_in_tax_ids.mapped('amount')) < 0)
            if is_negative_tax:
                counterpart_account_id = pay.outstanding_account_id
                (pay.move_id.line_ids + move.line_ids).filtered(lambda l: l.account_id == counterpart_account_id).reconcile()

    def action_post(self):
        res = super().action_post()
        self._create_advanced_payment_tax_move()
        return res
