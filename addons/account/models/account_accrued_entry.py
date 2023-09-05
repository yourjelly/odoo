# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import json
from markupsafe import escape
from odoo import models, _


class AccruedEntryMixin(models.AbstractModel):
    _name = 'account.accrued.entry.mixin'
    _description = 'Account Accrued Entry Mixin'

    def _get_preview_data(self, move_vals, currency_id=None):
        preview_columns = [
            {'field': 'account_id', 'label': _('Account')},
            {'field': 'name', 'label': _('Label')},
            {'field': 'debit', 'label': _('Debit'), 'class': 'text-end text-nowrap'},
            {'field': 'credit', 'label': _('Credit'), 'class': 'text-end text-nowrap'},
        ]
        preview_vals = [self.env['account.move']._move_dict_to_preview_vals(move_vals, currency_id)]
        return json.dumps({
            'groups_vals': preview_vals,
            'options': {
                'columns': preview_columns,
            },
        })

    def _get_aml_vals(self, label, balance, account_id, currency_id=None, amount_currency=None, analytic_distribution=None):
        values = {
            'name': label,
            'debit': balance if balance > 0 else 0,
            'credit': -balance if balance < 0 else 0,
            'account_id': account_id,
        }
        if currency_id and amount_currency is not None:
            values.update({
                'currency_id': currency_id,
                'amount_currency': amount_currency,
            })
        if analytic_distribution:
            values.update({
                'analytic_distribution': analytic_distribution,
            })
        return values

    def _get_move_vals(self):
        """
        To be overriden as every accrued entry has their own specific process
        """
        return {}

    def create_and_reverse_move(self):
        self.ensure_one()
        move_vals = self._get_move_vals()
        move = self.env['account.move'].create(move_vals)
        move.action_post()
        reverse_move = move._reverse_moves(default_values_list=[{
            'ref': _("Reversal of: %s", move.ref),
        }])
        reverse_move.action_post()
        return move, reverse_move

    def create_order_post(self, order_with_entries, date, move, reverse_move):
        body = escape(_(
            'Accrual entry created on %(date)s: %(accrual_entry)s.\
                And its reverse entry: %(reverse_entry)s.')) % {
            'date': date,
            'accrual_entry': move._get_html_link(),
            'reverse_entry': reverse_move._get_html_link(),
        }
        for order in order_with_entries:
            order.message_post(body=body)
