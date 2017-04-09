# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api, _
import datetime

class account_move_line(models.Model):
    _inherit = 'account.move.line'
    user_type = fields.Selection(related='account_id.user_type_id.type', string='Account Type', readonly=True)

    opening_debit = fields.Float(compute='_get_opening_debit_credit', inverse='_set_opening_debit')
    opening_credit = fields.Float(compute='_get_opening_debit_credit', inverse='_set_opening_debit')
    opening_link_id = fields.Many2one('account.move.line', string='Opening Receivable of')
    opening_linked_ids = fields.One2many('account.move.line', 'opening_link_id', string='Opening Receivables')

    @api.depends('credit','debit')
    def _get_opening_debit_credit(self):
        for record in self:
            record.opening_debit = record.debit + sum(record.opening_linked_ids.mapped('debit'))
            record.opening_credit = record.credit + sum(record.opening_linked_ids.mapped('credit'))

    def _set_opening_credit(self):
        return self._set_opening_debit(field='credit')

    def _set_opening_debit(self, field='debit'):
        for record in self:
            newval = getattr(record, 'opening_'+field)
            setattr(record.with_context(check_move_validity=False), field, newval)
            diff = sum(record.move_id.line_ids.mapped('debit')) - sum(record.move_id.line_ids.mapped('credit'))
            if not diff:
                return True

            # TODO: if no account: raise
            account = self.env.user.company_id.expense_currency_exchange_account_id
            line = record.search([('move_id','=',record.move_id.id), ('account_id','=',account.id)])
            if line:
                diff += line.credit - line.debit
                line.write({
                    'debit': max(-diff, 0),
                    'credit': max(diff, 0),
                })
            else:
                record.env['account.move.line'].create({
                    'name': _('Opening Entry'),
                    'account_id': account.id,
                    'move_id': record.move_id.id,
                    'debit': max(-diff, 0),
                    'credit': max(diff, 0),
                })
        return True

    def open_opening_receivable_balance(self):
        return {
            'name': _('Outstanding Invoices & Payments'),
            'view_type': 'form',
            'view_mode': 'tree',
            'view_id': self.env.ref('account_accountant.account_move_opening_receivable_tree', False).id,
            'res_model': 'account.move.line',
            'type': 'ir.actions.act_window',
            'domain': [('move_id', '=', self.move_id.id), ('opening_link_id','=',self.id)],
            'context': {
                'default_move_id': self.move_id.id,
                'default_opening_link_id':self.id,
                'default_account_id':self.account_id.id,
                'default_date': self.move_id.date
            },
        }

    @api.model
    def open_opening_balance(self):
        company = self.env.user.company_id
        if not company.opening_balance_move_id or company.opening_balance_move_id.state=='posted':
            date = datetime.date.today()
            journal = self.env['account.journal'].search([('type', '=', 'general')], limit=1).id
            date.replace(day=1)
            move_id = self.env['account.move'].create({
                'date': date,
                'ref': _('Opening Entry'),
                'journal_id': journal,
            })
            company.opening_balance_move_id = move_id
        else:
            move_id = company.opening_balance_move_id

        account_ids = move_id.line_ids.mapped('account_id.id')
        data = []
        for account in self.env['account.account'].search([('company_id','=',company.id), ('id','not in', account_ids)], order="code desc"):
            data.append((0,0, {
                'account_id': account.id,
                'name': _('Opening Entry'),
                'move_id': move_id.id,
                'debit': 0,
                'credit': 0
            }))
        move_id.with_context(check_move_validity=False).write({'line_ids': data})
        return {
            'name': _('Opening Entry'),
            'view_type': 'form',
            'view_mode': 'tree',
            'view_id': self.env.ref('account_accountant.account_move_opening_tree', False).id,
            'res_model': 'account.move.line',
            'type': 'ir.actions.act_window',
            'domain': [('move_id', '=', move_id.id), ('opening_link_id','=',False)],
            'context': [('default_move_id', '=', move_id.id)],
        }

class res_company(models.Model):
    _inherit='res.company'
    account_config_close = fields.Boolean('Account Config')
    opening_balance_move_id = fields.Many2one('account.move', string='Opening Entry')


class AccountJournal(models.Model):
    _inherit = 'account.journal'

    @api.model
    def retrieve_account_dashboard(self):
        company = self.env.user.company_id
        if company.account_config_close:
            return {'open': False}

        data = {'open':True}
        data['company'] = bool(company.street)
        data['banks'] = bool(self.env['account.journal'].search([
            ('company_id', '=', company.id), ('bank_acc_number','<>',False)],
            limit=1))
        data['chart'] = False

        accounts = self.env['account.account'].search([
            ('company_id', '=', company.id), ('user_type_id.type','<>','liquidity')])
        for a in accounts:
            if a.create_date <> accounts[0].create_date:
                data['chart'] = True
                break

        data['initial'] = bool(self.env.user.company_id.opening_balance_move_id.amount)
        return data
