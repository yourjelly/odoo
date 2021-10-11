# -*- coding: utf-8 -*-
from datetime import date, timedelta

from odoo import api, fields, models, _
from odoo.tools import date_utils


class AccountFullReconcile(models.Model):
    _name = "account.full.reconcile"
    _description = "Full Reconcile"

    name = fields.Char(string='Number', required=True, copy=False, default=lambda self: self.env['ir.sequence'].next_by_code('account.reconcile'))
    partial_reconcile_ids = fields.One2many('account.partial.reconcile', 'full_reconcile_id', string='Reconciliation Parts')
    reconciled_line_ids = fields.One2many('account.move.line', 'full_reconcile_id', string='Matched Journal Items')
    exchange_move_id = fields.Many2one('account.move')

    def unlink(self):
        """ When removing a full reconciliation, we need to revert the eventual journal entries we created to book the
            fluctuation of the foreign currency's exchange rate.
            We need also to reconcile together the origin currency difference line and its reversal in order to completely
            cancel the currency difference entry on the partner account (otherwise it will still appear on the aged balance
            for example).
        """
        # Avoid cyclic unlink calls when removing partials.
        if not self:
            return True

        moves_to_reverse = self.exchange_move_id

        res = super().unlink()

        # Reverse all exchange moves at once.
        default_values_list = [{
            'date': self._get_exchange_diff_date(move),
            'ref': _('Reversal of: %s') % move.name,
        } for move in moves_to_reverse]
        moves_to_reverse._reverse_moves(default_values_list, cancel=True)

        return res

    def _get_exchange_diff_date(self, move):
        tax_lock_date = any(line._affect_tax_report() for line in move.line_ids) and move.company_id.tax_lock_date or date.min
        fiscal_lock_date = move.company_id._get_user_fiscal_lock_date() or date.min
        lock_date = max(tax_lock_date, fiscal_lock_date)
        if lock_date >= move.date:
            # return earliest between today and first end of month after Lock Date
            today = fields.Date.context_today(self)
            month_end_after_lockdate = date_utils.get_month(lock_date + timedelta(days=1))[1]
            return min(today, month_end_after_lockdate)
        return move.date
