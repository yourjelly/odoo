# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api, _
from odoo.api import ondelete
from odoo.exceptions import UserError
from odoo.tools.misc import frozendict


class AccountMove(models.Model):
    _inherit = "account.move"

    expense_sheet_id = fields.Many2one(comodel_name='hr.expense.sheet', ondelete='set null', copy=False, index='btree_not_null')

    def action_open_expense_report(self):
        self.ensure_one()
        return {
            'name': self.expense_sheet_id.name,
            'type': 'ir.actions.act_window',
            'view_mode': 'form',
            'views': [(False, 'form')],
            'res_model': 'hr.expense.sheet',
            'res_id': self.expense_sheet_id.id
        }

    # Expenses can be written on journal other than purchase, hence don't include them in the constraint check
    def _check_journal_move_type(self):
        return super(AccountMove, self.filtered(lambda x: not x.expense_sheet_id))._check_journal_move_type()

    def _creation_message(self):
        if self.expense_sheet_id:
            return _("Expense entry created from: %s", self.expense_sheet_id._get_html_link())
        return super()._creation_message()

    def _prepare_product_base_line_for_taxes_computation(self, product_line, reverse_quantity_sign=False):
        # EXTENDS account
        values = super()._prepare_product_base_line_for_taxes_computation(product_line, reverse_quantity_sign=reverse_quantity_sign)
        if self.expense_sheet_id:
            values['special_mode'] = 'total_included'
        return values

    def _prepare_epd_base_line_for_taxes_computation(self, grouping_key, amounts):
        # EXTENDS account
        values = super()._prepare_epd_base_line_for_taxes_computation(grouping_key, amounts)
        if self.expense_sheet_id:
            values['special_mode'] = 'total_included'
        return values

    @api.depends('expense_sheet_id')
    def _compute_sync_term_lines(self):
        # EXTENDS account
        # We want to set the account destination based on the 'payment_mode'.
        super()._compute_sync_term_lines()
        for move in self:
            if move.expense_sheet_id.payment_mode == 'company_account':
                date_maturity = move.expense_sheet_id.accounting_date or fields.Date.context_today(move)
                account_id = move.expense_sheet_id._get_expense_account_destination()
                key = frozendict({
                    'move_id': move.id,
                    'date_maturity': date_maturity,
                    'discount_date': False,
                    'account_id': account_id,
                    'display_type': 'payment_term',
                })
                new_sync_term_lines = {}
                for grouping_key, amounts in (move.sync_term_lines or {}).items():
                    new_amounts = new_sync_term_lines.setdefault(key, {
                        'name': False,
                        'amount_currency': 0.0,
                        'balance': 0.0,
                        'discount_balance': 0.0,
                        'discount_amount_currency': 0.0,
                    })
                    new_amounts['balance'] += amounts['balance']
                    new_amounts['amount_currency'] += amounts['amount_currency']

                move.sync_term_lines = new_sync_term_lines

    def _reverse_moves(self, default_values_list=None, cancel=False):
        # EXTENDS account
        own_expense_moves = self.filtered(lambda move: move.expense_sheet_id.payment_mode == 'own_account')
        own_expense_moves.write({'expense_sheet_id': False, 'ref': False})
        # else, when restarting the expense flow we get duplicate issue on vendor.bill
        return super()._reverse_moves(default_values_list=default_values_list, cancel=cancel)

    @ondelete(at_uninstall=True)
    def _must_delete_all_expense_entries(self):
        if self.expense_sheet_id and self.expense_sheet_id.account_move_ids - self:  # If not all the payments are to be deleted
            raise UserError(_("You cannot delete only some entries linked to an expense report. All entries must be deleted at the same time."))

    def button_cancel(self):
        # EXTENDS account
        # We need to override this method to unlink the move from the expenses paid by an employee, else we cannot reimburse them anymore.
        # And cancelling the move != cancelling the expense
        res = super().button_cancel()
        own_expense_moves = self.filtered(lambda move: move.expense_sheet_id.payment_mode == 'own_account')
        own_expense_moves.write({'expense_sheet_id': False, 'ref': False})
        return res
