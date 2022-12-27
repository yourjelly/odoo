# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, _
# from odoo.exceptions import UserError


class AccountBankStatementLine(models.Model):
    _inherit = 'account.bank.statement.line'

    def button_undo_reconciliation(self):
        if not self.env['hr.expense.sheet'].search_count([('account_move_id', '=', self.move_id.id)]):
            super().button_undo_reconciliation()
        else:
            # The standard logic assumes the bank statement line is linked to a journal entry that represents it. When
            # unreconciling, the contents of the journal entry are deleted and replaced with two lines transferring the
            # amount of the bank statement line from the bank statement to the suspense account.
            #
            # When working with a pre-14.0 database that was upgraded, it's possible for the bank statement line to
            # be pointing directly to a payment journal entry. In that case the same logic is applied, and on
            # unreconciliation the contents of the payment journal entry are deleted and replaced. This is acceptable
            # since normally the payment has no impact on the accounts when it's reconciled with a bank statement and
            # an invoice.
            #
            # In the upgraded pre-14.0 database case, it's also possible for the bank statement line to point directly
            # to an expense report. In that case the standard logic is destructive, since it will delete the contents
            # of the expense report journal entry, which can include many lines of expenses. Instead of doing that, we
            # leave the expense report journal entry as is, except for replacing the bank account with the appropriate
            # outstanding account. This keeps the data intact and allows the user to reconcile again afterwards if they
            # want to.
            self.line_ids.remove_move_reconcile()
            self.payment_ids.unlink()

            # for st_line in self:
            #     st_line.with_context(force_delete=True).write({
            #         'to_check': False,
            #         'line_ids': [(5, 0)] + [(0, 0, line_vals) for line_vals in st_line._prepare_move_line_default_vals()],
            #     })


# class AccountBankStatement(models.Model):
#     _inherit = 'account.bank.statement'
#
#     def button_reopen(self):
#         if not self.env['hr.expense.sheet'].search_count([('account_move_id', '=', self.move_id.id)]):
#             super().button_reopen()
#         else:
#             # This is identical to the standard implementation except we don't set the linked expense report journal
#             # entry to draft. -> or maybe this isn't any issue
#             if any(statement.state == 'draft' for statement in self):
#                 raise UserError(_("Only validated statements can be reset to new."))
#
#             self.write({'state': 'open'})
#             self.line_ids.move_id.button_draft()
#             self.line_ids.button_undo_reconciliation()
