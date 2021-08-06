# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from dateutil.relativedelta import relativedelta
from collections import defaultdict
import json
from odoo import models, fields, api, _, Command
from odoo.tools import format_date
from odoo.exceptions import UserError


class AccruedExpenseRevenue(models.TransientModel):
    _name = 'account.accrued.orders.wizard'
    _description = 'Accrued Orders Wizard'

    def _get_account_domain(self):
        if self.env.context.get('active_model') == 'purchase.order':
            return [('user_type_id', '=', self.env.ref('account.data_account_type_current_liabilities').id)]
        else:
            return [('user_type_id', '=', self.env.ref('account.data_account_type_current_assets').id)]

    company_id = fields.Many2one('res.company', default=lambda self: self.env.company)
    journal_id = fields.Many2one(
        comodel_name='account.journal',
        compute='_compute_journal_id',
        domain=[('type', '=', 'general'), ('company_id', '=', company_id)],
        readonly=False,
        required=True,
        string='Journal',
    )
    date = fields.Date(default=fields.Date.today(), required=True)
    reversal_date = fields.Date(
        compute="_compute_reversal_date",
        required=True,
        readonly=False,
    )
    account_id = fields.Many2one(
        comodel_name='account.account',
        required=True,
        string='Accrual Account',
        domain=_get_account_domain,
    )
    preview_data = fields.Text(compute='_compute_preview_data')

    @api.depends('date')
    def _compute_reversal_date(self):
        for record in self:
            if not record.reversal_date or record.reversal_date <= record.data:
                record.reversal_date = record.date + relativedelta(days=1)
            else:
                record.revesal_date = record.revesal_date

    @api.depends('company_id')
    def _compute_journal_id(self):
        journal = self.env['account.journal'].search(
            [('type', '=', 'general'), ('company_id', '=', self.env.company.id)], limit=1
        )
        for record in self:
            record.journal_id = journal

    @api.depends('date', 'journal_id', 'account_id')
    def _compute_preview_data(self):
        for record in self:
            preview_vals = [self.env['account.move']._move_dict_to_preview_vals(
                self._compute_move_vals()[0],
                record.company_id.currency_id,
            )]
            preview_columns = [
                {'field': 'account_id', 'label': _('Account')},
                {'field': 'name', 'label': _('Label')},
                {'field': 'debit', 'label': _('Debit'), 'class': 'text-right text-nowrap'},
                {'field': 'credit', 'label': _('Credit'), 'class': 'text-right text-nowrap'},
            ]
            record.preview_data = json.dumps({
                'groups_vals': preview_vals,
                'options': {
                    'columns': preview_columns,
                },
            })

    def _compute_move_vals(self):
        move_lines = []
        is_purchase = self.env.context.get('active_model') == 'purchase.order'
        orders = self.env[self._context['active_model']].browse(self._context['active_ids'])

        if orders.filtered(lambda o: o.company_id != self.company_id):
            raise UserError(_('Entries can only be created for the current company.'))

        orders_with_entries = []
        for order in orders:
            total_balance = 0.0
            total_amount_currency = 0.0
            inc_exp_accounts = defaultdict(lambda: defaultdict(float))
            lines = order.order_line.filtered(
                lambda l: not fields.Float.is_zero(
                    l.qty_to_invoice,
                    precision_digits=l.product_uom.rounding,
                )
            )
            other_currency = self.company_id.currency_id != order.currency_id
            rate = order.currency_id._get_rates(self.company_id, self.date).get(order.currency_id.id) if other_currency else 1.0
            for order_line in lines:
                if is_purchase:
                    account = order_line.product_id.property_account_expense_id or order_line.product_id.categ_id.property_account_expense_categ_id
                    amount = self.company_id.currency_id.round(order_line.qty_to_invoice * order_line.price_unit / rate)
                    amount_currency = order_line.currency_id.round(order_line.qty_to_invoice * order_line.price_unit)
                else:
                    account = order_line.product_id.property_account_income_id or order_line.product_id.categ_id.property_account_income_categ_id
                    amount_currency = self._get_sale_order_line_amount_to_invoice(order_line)
                    amount = self.company_id.currency_id.round(amount_currency / rate)
                inc_exp_accounts[account]['amount'] += amount
                inc_exp_accounts[account]['amount_currency'] += amount_currency
                total_balance += amount
                total_amount_currency += amount_currency

            if not self.company_id.currency_id.is_zero(total_balance):
                orders_with_entries.append(order)
                for inc_exp_account, amounts in inc_exp_accounts.items():
                    balance = amounts['amount']
                    amount_currency = amounts['amount_currency']
                    if not is_purchase:
                        balance *= -1
                        amount_currency *= -1
                    values = {
                        'name': _('Accrued for %s', order.name),
                        'debit': balance if balance > 0 else 0.0,
                        'credit': balance * -1 if balance < 0 else 0.0,
                        'account_id': inc_exp_account.id,
                    }
                    if other_currency:
                        values.update({
                            'amount_currency': amount_currency,
                            'currency_id': order.currency_id.id,
                        })
                    move_lines.append(Command.create(values))

                if is_purchase:
                    total_balance *= -1
                    total_amount_currency *= -1
                values = {
                    'name': _('Accrued for %s', order.name),
                    'debit': total_balance if total_balance > 0 else 0.0,
                    'credit': total_balance * -1 if total_balance < 0 else 0.0,
                    'account_id': self.account_id.id,
                }
                if other_currency:
                    values.update({
                        'amount_currency': total_amount_currency,
                        'currency_id': order.currency_id.id,
                    })
                move_lines.append(Command.create(values))

        move_type = _('Expense') if is_purchase else _('Revenue')
        move_vals = {
            'ref': _('Accrued %s entry as of %s', move_type, format_date(self.env, self.date)),
            'journal_id': self.journal_id.id,
            'date': self.date,
            'line_ids': move_lines,
        }
        return move_vals, orders_with_entries

    def _get_sale_order_line_amount_to_invoice(self, sale_order_line):
        # hook
        return sale_order_line.untaxed_amount_to_invoice

    def create_entries(self):
        self.ensure_one()

        if(self.reversal_date <= self.date):
            raise UserError(_('Reversal date must be posterior to date.'))

        move_vals, orders_with_entries = self._compute_move_vals()
        if not move_vals:
            raise UserError(_('No accrued entries to create.'))
        move = self.env['account.move'].create(move_vals)
        move._post()
        reverse_move = move._reverse_moves(default_values_list=[{
            'ref': _('Reversal of: %s', move.ref),
            'date': self.reversal_date,
        }])
        reverse_move._post()
        for order in orders_with_entries:
            body = _('Accrual entry created on %s:\
                <a href=# data-oe-model=account.move data-oe-id=%d>%s</a>.') % (
                self.date,
                move.id,
                move.name,
            )
            order.message_post(body=body)
        return {
            'name': _('Accrual Moves'),
            'type': 'ir.actions.act_window',
            'res_model': 'account.move',
            'view_mode': 'tree',
            'domain': [('id', 'in', (move.id, reverse_move.id))],
        }
