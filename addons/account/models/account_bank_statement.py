# -*- coding: utf-8 -*-

from odoo import api, fields, models, _
from odoo.osv import expression
from odoo.tools import float_is_zero
from odoo.tools import float_compare, float_round, float_repr
from odoo.tools.misc import formatLang, format_date
from odoo.exceptions import UserError, ValidationError

import time
import math
import base64
import re


class AccountCashboxLine(models.Model):
    """ Cash Box Details """
    _name = 'account.cashbox.line'
    _description = 'CashBox Line'
    _rec_name = 'coin_value'
    _order = 'coin_value'

    @api.depends('coin_value', 'number')
    def _sub_total(self):
        """ Calculates Sub total"""
        for cashbox_line in self:
            cashbox_line.subtotal = cashbox_line.coin_value * cashbox_line.number

    coin_value = fields.Float(string='Coin/Bill Value', required=True, digits=0)
    number = fields.Integer(string='#Coins/Bills', help='Opening Unit Numbers')
    subtotal = fields.Float(compute='_sub_total', string='Subtotal', digits=0, readonly=True)
    cashbox_id = fields.Many2one('account.bank.statement.cashbox', string="Cashbox")
    currency_id = fields.Many2one('res.currency', related='cashbox_id.currency_id')


class AccountBankStmtCashWizard(models.Model):
    """
    Account Bank Statement popup that allows entering cash details.
    """
    _name = 'account.bank.statement.cashbox'
    _description = 'Bank Statement Cashbox'

    cashbox_lines_ids = fields.One2many('account.cashbox.line', 'cashbox_id', string='Cashbox Lines')
    start_bank_stmt_ids = fields.One2many('account.bank.statement', 'cashbox_start_id')
    end_bank_stmt_ids = fields.One2many('account.bank.statement', 'cashbox_end_id')
    total = fields.Float(compute='_compute_total')
    currency_id = fields.Many2one('res.currency', compute='_compute_currency')

    @api.depends('start_bank_stmt_ids', 'end_bank_stmt_ids')
    def _compute_currency(self):
        for cashbox in self:
            cashbox.currency_id = False
            if cashbox.end_bank_stmt_ids:
                cashbox.currency_id = cashbox.end_bank_stmt_ids[0].currency_id
            if cashbox.start_bank_stmt_ids:
                cashbox.currency_id = cashbox.start_bank_stmt_ids[0].currency_id

    @api.depends('cashbox_lines_ids', 'cashbox_lines_ids.coin_value', 'cashbox_lines_ids.number')
    def _compute_total(self):
        for cashbox in self:
            cashbox.total = sum([line.subtotal for line in cashbox.cashbox_lines_ids])

    @api.model
    def default_get(self, fields):
        vals = super(AccountBankStmtCashWizard, self).default_get(fields)
        balance = self.env.context.get('balance')
        statement_id = self.env.context.get('statement_id')
        if 'start_bank_stmt_ids' in fields and not vals.get('start_bank_stmt_ids') and statement_id and balance == 'start':
            vals['start_bank_stmt_ids'] = [(6, 0, [statement_id])]
        if 'end_bank_stmt_ids' in fields and not vals.get('end_bank_stmt_ids') and statement_id and balance == 'close':
            vals['end_bank_stmt_ids'] = [(6, 0, [statement_id])]

        return vals

    def name_get(self):
        result = []
        for cashbox in self:
            result.append((cashbox.id, _("%s")%(cashbox.total)))
        return result

    @api.model_create_multi
    def create(self, vals):
        cashboxes = super(AccountBankStmtCashWizard, self).create(vals)
        cashboxes._validate_cashbox()
        return cashboxes

    def write(self, vals):
        res = super(AccountBankStmtCashWizard, self).write(vals)
        self._validate_cashbox()
        return res

    def _validate_cashbox(self):
        for cashbox in self:
            if cashbox.start_bank_stmt_ids:
                cashbox.start_bank_stmt_ids.write({'balance_start': cashbox.total})
            if cashbox.end_bank_stmt_ids:
                cashbox.end_bank_stmt_ids.write({'balance_end_real': cashbox.total})


class AccountBankStmtCloseCheck(models.TransientModel):
    """
    Account Bank Statement wizard that check that closing balance is correct.
    """
    _name = 'account.bank.statement.closebalance'
    _description = 'Bank Statement Closing Balance'

    def validate(self):
        bnk_stmt_id = self.env.context.get('active_id', False)
        if bnk_stmt_id:
            self.env['account.bank.statement'].browse(bnk_stmt_id).button_validate()
        return {'type': 'ir.actions.act_window_close'}


class AccountBankStatement(models.Model):
    _name = "account.bank.statement"
    _description = "Bank Statement"
    _order = "date desc, name desc, id desc"
    _inherit = ['mail.thread', 'sequence.mixin']

    # Note: the reason why we did 2 separate function with the same dependencies (one for balance_start and one for balance_end_real)
    # is because if we create a bank statement with a default value for one of the field but not the other, the compute method
    # won't be called and therefore the other field will have a value of 0 and we don't want that.
    @api.depends('previous_statement_id', 'previous_statement_id.balance_end_real')
    def _compute_starting_balance(self):
        for statement in self:
            if statement.previous_statement_id.balance_end_real != statement.balance_start:
                statement.balance_start = statement.previous_statement_id.balance_end_real
            else:
                # Need default value
                statement.balance_start = statement.balance_start or 0.0

    @api.depends('previous_statement_id', 'previous_statement_id.balance_end_real')
    def _compute_ending_balance(self):
        latest_statement = self.env['account.bank.statement'].search([('journal_id', '=', self[0].journal_id.id)], limit=1)
        for statement in self:
            # recompute balance_end_real in case we are in a bank journal and if we change the
            # balance_end_real of previous statement as we don't want
            # holes in case we add a statement in between 2 others statements.
            # We only do this for the bank journal as we use the balance_end_real in cash
            # journal for verification and creating cash difference entries so we don't want
            # to recompute the value in that case
            if statement.journal_type == 'bank':
                # If we are on last statement and that statement already has a balance_end_real, don't change the balance_end_real
                # Otherwise, recompute balance_end_real to prevent holes between statement.
                if latest_statement.id and statement.id == latest_statement.id and not float_is_zero(statement.balance_end_real, precision_digits=statement.currency_id.decimal_places):
                    statement.balance_end_real = statement.balance_end_real or 0.0
                else:
                    total_entry_encoding = sum([line.amount for line in statement.line_ids])
                    statement.balance_end_real = statement.previous_statement_id.balance_end_real + total_entry_encoding
            else:
                # Need default value
                statement.balance_end_real = statement.balance_end_real or 0.0

    @api.depends('line_ids', 'balance_start', 'line_ids.amount', 'balance_end_real')
    def _end_balance(self):
        for statement in self:
            statement.total_entry_encoding = sum([line.amount for line in statement.line_ids])
            statement.balance_end = statement.balance_start + statement.total_entry_encoding
            statement.difference = statement.balance_end_real - statement.balance_end

    def _is_difference_zero(self):
        for bank_stmt in self:
            bank_stmt.is_difference_zero = float_is_zero(bank_stmt.difference, precision_digits=bank_stmt.currency_id.decimal_places)

    @api.depends('journal_id')
    def _compute_currency(self):
        for statement in self:
            statement.currency_id = statement.journal_id.currency_id or statement.company_id.currency_id

    @api.depends('move_line_ids')
    def _get_move_line_count(self):
        for payment in self:
            payment.move_line_count = len(payment.move_line_ids)

    @api.model
    def _default_journal(self):
        journal_type = self.env.context.get('journal_type', False)
        company_id = self.env.company.id
        if journal_type:
            journals = self.env['account.journal'].search([('type', '=', journal_type), ('company_id', '=', company_id)])
            if journals:
                return journals[0]
        return self.env['account.journal']

    def _get_opening_balance(self, journal_id):
        last_bnk_stmt = self.search([('journal_id', '=', journal_id)], limit=1)
        if last_bnk_stmt:
            return last_bnk_stmt.balance_end
        return 0

    def _set_opening_balance(self, journal_id):
        self.balance_start = self._get_opening_balance(journal_id)

    @api.model
    def _default_opening_balance(self):
        #Search last bank statement and set current opening balance as closing balance of previous one
        journal_id = self._context.get('default_journal_id', False) or self._context.get('journal_id', False)
        if journal_id:
            return self._get_opening_balance(journal_id)
        return 0

    @api.depends('balance_start', 'previous_statement_id')
    def _compute_is_valid_balance_start(self):
        for bnk in self:
            bnk.is_valid_balance_start = float_is_zero(bnk.balance_start - bnk.previous_statement_id.balance_end_real, precision_digits=bnk.currency_id.decimal_places)

    @api.depends('date', 'journal_id')
    def _get_previous_statement(self):
        for st in self:
            # Search for the previous statement
            domain = [('date', '<=', st.date), ('journal_id', '=', st.journal_id.id)]
            # The reason why we have to perform this test is because we have two use case here:
            # First one is in case we are creating a new record, in that case that new record does
            # not have any id yet. However if we are updating an existing record, the domain date <= st.date
            # will find the record itself, so we have to add a condition in the search to ignore self.id
            if not isinstance(st.id, models.NewId):
                domain.append(('id', '!=', st.id))
            previous_statement = self.search(domain, limit=1)
            st.previous_statement_id = previous_statement.id

    name = fields.Char(string='Reference', states={'open': [('readonly', False)]}, copy=False, readonly=True)
    reference = fields.Char(string='External Reference', states={'open': [('readonly', False)]}, copy=False, readonly=True, help="Used to hold the reference of the external mean that created this statement (name of imported file, reference of online synchronization...)")
    date = fields.Date(required=True, states={'confirm': [('readonly', True)]}, index=True, copy=False, default=fields.Date.context_today)
    date_done = fields.Datetime(string="Closed On")
    balance_start = fields.Monetary(string='Starting Balance', states={'confirm': [('readonly', True)]}, compute='_compute_starting_balance', readonly=False, store=True)
    balance_end_real = fields.Monetary('Ending Balance', states={'confirm': [('readonly', True)]}, compute='_compute_ending_balance', readonly=False, store=True)
    state = fields.Selection(string='Status', required=True, readonly=True, copy=False, selection=[
            ('open', 'New'),
            ('posted', 'Processing'),
            ('confirm', 'Validated'),
        ], default='open',
        help="The current state of your bank statement:"
             "- New: Fully editable with draft Journal Entries."
             "- Processing: No longer editable with posted Journal entries, ready for the reconciliation."
             "- Validated: All lines are reconciled. There is nothing left to process.")
    currency_id = fields.Many2one('res.currency', compute='_compute_currency', string="Currency")
    journal_id = fields.Many2one('account.journal', string='Journal', required=True, states={'confirm': [('readonly', True)]}, default=_default_journal)
    journal_type = fields.Selection(related='journal_id.type', help="Technical field used for usability purposes")
    company_id = fields.Many2one('res.company', related='journal_id.company_id', string='Company', store=True, readonly=True,
        default=lambda self: self.env.company)

    total_entry_encoding = fields.Monetary('Transactions Subtotal', compute='_end_balance', store=True, help="Total of transaction lines.")
    balance_end = fields.Monetary('Computed Balance', compute='_end_balance', store=True, help='Balance as calculated based on Opening Balance and transaction lines')
    difference = fields.Monetary(compute='_end_balance', store=True, help="Difference between the computed ending balance and the specified ending balance.")

    line_ids = fields.One2many('account.bank.statement.line', 'statement_id', string='Statement lines', states={'confirm': [('readonly', True)]}, copy=True)
    move_line_ids = fields.One2many('account.move.line', 'statement_id', string='Entry lines', states={'confirm': [('readonly', True)]})
    move_line_count = fields.Integer(compute="_get_move_line_count")

    all_lines_reconciled = fields.Boolean(compute='_compute_all_lines_reconciled',
        help="Technical field indicating if all statement lines are fully reconciled.")
    user_id = fields.Many2one('res.users', string='Responsible', required=False, default=lambda self: self.env.user)
    cashbox_start_id = fields.Many2one('account.bank.statement.cashbox', string="Starting Cashbox")
    cashbox_end_id = fields.Many2one('account.bank.statement.cashbox', string="Ending Cashbox")
    is_difference_zero = fields.Boolean(compute='_is_difference_zero', string='Is zero', help="Check if difference is zero.")
    previous_statement_id = fields.Many2one('account.bank.statement', help='technical field to compute starting balance correctly', compute='_get_previous_statement', store=True)
    is_valid_balance_start = fields.Boolean(string="Is Valid Balance Start", store=True,
        compute="_compute_is_valid_balance_start",
        help="technical field to display a warning message in case starting balance is different than previous ending balance")

    def write(self, values):
        res = super(AccountBankStatement, self).write(values)
        if values.get('date') or values.get('journal'):
            # If we are changing the date or journal of a bank statement, we have to change its previous_statement_id. This is done
            # automatically using the compute function, but we also have to change the previous_statement_id of records that were
            # previously pointing toward us and records that were pointing towards our new previous_statement_id. This is done here
            # by marking those record as needing to be recomputed.
            # Note that marking the field is not enough as we also have to recompute all its other fields that are depending on 'previous_statement_id'
            # hence the need to call modified afterwards.
            to_recompute = self.search([('previous_statement_id', 'in', self.ids), ('id', 'not in', self.ids)])
            if to_recompute:
                self.env.add_to_compute(self._fields['previous_statement_id'], to_recompute)
                to_recompute.modified(['previous_statement_id'])
            next_statements_to_recompute = self.search([('previous_statement_id', 'in', [st.previous_statement_id.id for st in self]), ('id', 'not in', self.ids)])
            if next_statements_to_recompute:
                self.env.add_to_compute(self._fields['previous_statement_id'], next_statements_to_recompute)
                next_statements_to_recompute.modified(['previous_statement_id'])
        return res

    @api.model_create_multi
    def create(self, values):
        res = super(AccountBankStatement, self).create(values)
        # Upon bank stmt creation, it is possible that the statement is inserted between two other statements and not at the end
        # In that case, we have to search for statement that are pointing to the same previous_statement_id as ourselve in order to
        # change their previous_statement_id to us. This is done by marking the field 'previous_statement_id' to be recomputed for such records.
        # Note that marking the field is not enough as we also have to recompute all its other fields that are depending on 'previous_statement_id'
        # hence the need to call modified afterwards.
        # The reason we are doing this here and not in a compute field is that it is not easy to write dependencies for such field.
        next_statements_to_recompute = self.search([('previous_statement_id', 'in', [st.previous_statement_id.id for st in res]), ('id', 'not in', res.ids)])
        if next_statements_to_recompute:
            self.env.add_to_compute(self._fields['previous_statement_id'], next_statements_to_recompute)
            next_statements_to_recompute.modified(['previous_statement_id'])
        return res

    @api.depends('line_ids.move_id.line_ids.matched_debit_ids', 'line_ids.move_id.line_ids.matched_credit_ids')
    def _compute_all_lines_reconciled(self):
        for statement in self:
            statement.all_lines_reconciled = all(st_line.is_reconciled for st_line in statement.line_ids)

    @api.onchange('journal_id')
    def onchange_journal_id(self):
        self._set_opening_balance(self.journal_id.id)
        for st_line in self.line_ids:
            st_line.journal_id = self.journal_id
            st_line.currency_id = self.journal_id.currency_id or self.company_id.currency_id

    def _balance_check(self):
        for stmt in self:
            if not stmt.currency_id.is_zero(stmt.difference):
                if stmt.journal_type == 'cash':
                    if stmt.difference < 0.0:
                        account = stmt.journal_id.loss_account_id
                        name = _('Loss')
                    else:
                        # statement.difference > 0.0
                        account = stmt.journal_id.profit_account_id
                        name = _('Profit')
                    if not account:
                        raise UserError(_('Please go on the %s journal and define a %s Account. This account will be used to record cash difference.') % (stmt.journal_id.name, name))

                    st_line_vals = {
                        'statement_id': stmt.id,
                        'journal_id': stmt.journal_id.id,
                        'amount': stmt.difference,
                        'payment_ref': _("Cash difference observed during the counting (%s)") % name,
                        'date': stmt.date,
                    }

                    # Override the suspense account with the profit/loss account.
                    default_aml_values = self.env['account.bank.statement.line']._prepare_move_line_default_vals(st_line_vals)
                    for vals in default_aml_values:
                        if vals['account_id'] == stmt.journal_id.suspense_account_id.id:
                            vals['account_id'] = account.id
                            break

                    st_line_vals['line_ids'] = [(0, 0, vals) for vals in default_aml_values]

                    self.env['account.bank.statement.line'].create(st_line_vals)
                else:
                    balance_end_real = formatLang(self.env, stmt.balance_end_real, currency_obj=stmt.currency_id)
                    balance_end = formatLang(self.env, stmt.balance_end, currency_obj=stmt.currency_id)
                    raise UserError(_('The ending balance is incorrect !\nThe expected balance (%s) is different from the computed one. (%s)')
                        % (balance_end_real, balance_end))
        return True

    def unlink(self):
        for statement in self:
            if statement.state != 'open':
                raise UserError(_('In order to delete a bank statement, you must first cancel it to delete related journal items.'))
            # Explicitly unlink bank statement lines so it will check that the related journal entries have been deleted first
            statement.line_ids.unlink()
            # Some other bank statements might be link to this one, so in that case we have to switch the previous_statement_id
            # from that statement to the one linked to this statement
            next_statement = self.search([('previous_statement_id', '=', statement.id)])
            if next_statement:
                next_statement.previous_statement_id = statement.previous_statement_id
        return super(AccountBankStatement, self).unlink()

    # -------------------------------------------------------------------------
    # CONSTRAINS METHODS
    # -------------------------------------------------------------------------

    @api.constrains('journal_id')
    def _check_journal(self):
        for statement in self:
            if any(st_line.journal_id != statement.journal_id for st_line in statement.line_ids):
                raise ValidationError(_('The journal of a bank statement line must always be the same as the bank statement one.'))

    # -------------------------------------------------------------------------
    # BUSINESS METHODS
    # -------------------------------------------------------------------------

    def open_cashbox_id(self):
        self.ensure_one()
        context = dict(self.env.context or {})
        if context.get('balance'):
            context['statement_id'] = self.id
            if context['balance'] == 'start':
                cashbox_id = self.cashbox_start_id.id
            elif context['balance'] == 'close':
                cashbox_id = self.cashbox_end_id.id
            else:
                cashbox_id = False

            action = {
                'name': _('Cash Control'),
                'view_mode': 'form',
                'res_model': 'account.bank.statement.cashbox',
                'view_id': self.env.ref('account.view_account_bnk_stmt_cashbox_footer').id,
                'type': 'ir.actions.act_window',
                'res_id': cashbox_id,
                'context': context,
                'target': 'new'
            }

            return action

    def button_post(self):
        ''' Move the bank statements from 'draft' to 'posted'. '''
        if any(statement.state != 'open' for statement in self):
            raise UserError(_("Only new statements can be posted."))

        self._balance_check()

        for statement in self:
            if not statement.name:
                statement._set_next_sequence()

        self.write({'state': 'posted'})
        self.mapped('line_ids.move_id').post()

    def button_validate(self):
        if any(statement.state != 'posted' or not statement.all_lines_reconciled for statement in self):
            raise UserError(_('All the account entries lines must be processed in order to validate the statement.'))

        for statement in self:

            # Chatter.
            statement.message_post(body=_('Statement %s confirmed.') % statement.name)

            # Bank statement report.
            if statement.journal_id.type == 'bank':
                content, content_type = self.env.ref('account.action_report_account_statement').render(statement.id)
                self.env['ir.attachment'].create({
                    'name': statement.name and _("Bank Statement %s.pdf") % statement.name or _("Bank Statement.pdf"),
                    'type': 'binary',
                    'datas': base64.encodebytes(content),
                    'res_model': statement._name,
                    'res_id': statement.id
                })

        self.write({'state': 'confirm', 'date_done': fields.Datetime.now()})

    def button_validate_or_action(self):
        if self.journal_type == 'cash' and not self.currency_id.is_zero(self.difference):
            action_rec = self.env['ir.model.data'].xmlid_to_object('account.action_view_account_bnk_stmt_check')
            if action_rec:
                action = action_rec.read()[0]
                return action

        return self.button_validate()

    def button_reopen(self):
        ''' Move the bank statements back to the 'open' state. '''
        if any(statement.state == 'draft' for statement in self):
            raise UserError(_("Only validated statements can be reset to new."))

        self.write({'state': 'open'})
        self.mapped('line_ids.move_id').button_draft()

    def button_journal_entries(self):
        return {
            'name': _('Journal Entries'),
            'view_mode': 'tree,form',
            'res_model': 'account.move',
            'view_id': False,
            'type': 'ir.actions.act_window',
            'domain': [('id', 'in', self.mapped('line_ids.move_id').ids)],
            'context': {
                'journal_id': self.journal_id.id,
            }
        }

    def _get_last_sequence_domain(self, relaxed=False):
        self.ensure_one()
        where_string = "WHERE journal_id = %(journal_id)s AND name != '/'"
        param = {'journal_id': self.journal_id.id}

        sequence_number_reset = self._deduce_sequence_number_reset(self.search([('date', '<', self.date)], order='date desc', limit=1).name)
        if not relaxed:
            if sequence_number_reset == 'year':
                where_string += " AND date_trunc('year', date) = date_trunc('year', %(date)s) "
                param['date'] = self.date
            elif sequence_number_reset == 'month':
                where_string += " AND date_trunc('month', date) = date_trunc('month', %(date)s) "
                param['date'] = self.date
        return where_string, param

    def _get_starting_sequence(self):
        self.ensure_one()
        last_sequence = self._get_last_sequence(relaxed=True)
        if last_sequence:
            sequence_number_reset = self._deduce_sequence_number_reset(self.search([('date', '<', self.date)], order='date desc', limit=1).name)
            if sequence_number_reset == 'year':
                sequence = re.match(self._sequence_yearly_regex, last_sequence)
                if sequence:
                    return '%s%04d%s%s%s' % (sequence.group('prefix1'), self.date.year, sequence.group('prefix2'), "0" * len(sequence.group('seq')), sequence.group('suffix'))
            elif sequence_number_reset == 'month':
                sequence = re.match(self._sequence_monthly_regex, last_sequence)
                if sequence:
                    return '%s%04d%s%02d%s%s%s' % (sequence.group('prefix1'), self.date.year, sequence.group('prefix2'), self.date.month, sequence.group('prefix3'), "0" * len(sequence.group('seq')), sequence.group('suffix'))

        # There was no pattern found, propose one
        return "%s/%04d/%02d/0000" % (self.journal_id.code, self.date.year, self.date.month)


class AccountBankStatementLine(models.Model):
    _name = "account.bank.statement.line"
    _inherits = {'account.move': 'move_id'}
    _description = "Bank Statement Line"
    _order = "statement_id desc, date, sequence, id desc"

    # TODO: Fields having the same name in both tables are confusing (partner_id & state). We don't change it because:
    # - It's a mess to track/fix.
    # - Some fields here could be simplify when the onchanges will be gone in account.move.

    # == Business fields ==
    move_id = fields.Many2one('account.move', string='Journal Entry', required=True, readonly=True, ondelete='cascade')
    statement_id = fields.Many2one('account.bank.statement', string='Statement', index=True, required=True, ondelete='cascade')

    sequence = fields.Integer(index=True, help="Gives the sequence order when displaying a list of bank statement lines.", default=1)
    account_number = fields.Char(string='Bank Account Number', help="Technical field used to store the bank account number before its creation, upon the line's processing")
    partner_name = fields.Char(help="This field is used to record the third party name when importing bank statement in electronic format, when the partner doesn't exist yet in the database (or cannot be found).")
    transaction_type = fields.Char(string='Transaction Type')
    payment_ref = fields.Char(string='Label', store=True, required=True,
        compute='_compute_from_move_lines',
        inverse='_inverse_payment_ref')
    amount = fields.Monetary(currency_field='currency_id', store=True,
        compute='_compute_from_move_lines',
        inverse='_inverse_amounts')
    amount_currency = fields.Monetary(currency_field='foreign_currency_id', store=True,
        compute='_compute_from_move_lines',
        inverse='_inverse_amounts',
        help="The amount expressed in an optional other currency if it is a multi-currency entry.")
    foreign_currency_id = fields.Many2one('res.currency', string='Foreign Currency', store=True,
        compute='_compute_from_move_lines',
        inverse='_inverse_amounts',
        help="The optional other currency if it is a multi-currency entry.")
    partner_id = fields.Many2one('res.partner', string='Partner', ondelete='restrict', store=True,
        compute='_compute_from_move_lines',
        inverse='_inverse_partner_id',
        domain="['|', ('parent_id','=', False), ('is_company','=',True)]")

    # == Display purpose fields ==
    is_reconciled = fields.Boolean(string='Is Reconciled', store=True,
        compute='_compute_is_reconciled',
        help="Technical field indicating if the statement line is already reconciled.")
    state = fields.Selection(related='statement_id.state', string='Status', readonly=True)

    # -------------------------------------------------------------------------
    # HELPERS
    # -------------------------------------------------------------------------

    @api.model
    def _assert_suspense_account(self, journal):
        if not journal.suspense_account_id:
            raise UserError(_("You can't create a new statement line without a suspense account set on the %s journal.")
                            % journal.display_name)

    def _seek_for_lines(self):
        ''' Helper used to dispatch the journal items between:
        - The lines using the liquidity account.
        - The lines using the transfer account.
        - The lines being not in one of the two previous categories.
        :return: (liquidity_lines, suspense_lines, other_lines)
        '''
        self._assert_suspense_account(self.journal_id)

        liquidity_lines = self.env['account.move.line']
        suspense_lines = self.env['account.move.line']
        other_lines = self.env['account.move.line']

        for line in self.move_id.line_ids:
            if line.account_id in (self.journal_id.default_debit_account_id, self.journal_id.default_credit_account_id):
                liquidity_lines += line
            elif line.account_id == self.journal_id.suspense_account_id:
                suspense_lines += line
            else:
                other_lines += line
        return liquidity_lines, suspense_lines, other_lines

    @api.model
    def _prepare_liquidity_move_line_vals(self, vals):
        ''' Prepare values to create a new account.move.line record corresponding to the
        liquidity line (having the bank/cash account).
        :param vals:    The values used to create the account.bank.statement.line record.
        :return:        The values to create a new account.move.line record.
        '''
        statement = self.env['account.bank.statement'].browse(vals['statement_id'])
        journal = statement.journal_id
        company_currency = journal.company_id.currency_id
        journal_currency = journal.currency_id if journal.currency_id != company_currency else False
        foreign_currency_id = vals.get('foreign_currency_id')
        date = vals.get('date', statement.date)

        if foreign_currency_id and journal_currency:
            currency_id = journal_currency.id
            if foreign_currency_id == company_currency.id:
                amount_currency = vals.get('amount', 0.0)
                balance = vals.get('amount_currency', 0.0)
            else:
                amount_currency = vals.get('amount', 0.0)
                balance = journal_currency._convert(amount_currency, journal.company_id.currency_id, journal.company_id, date)
        elif foreign_currency_id and not journal_currency:
            if foreign_currency_id == company_currency.id:
                amount_currency = 0.0
                balance = vals.get('amount', 0.0)
                currency_id = False
            else:
                amount_currency = vals.get('amount_currency', 0.0)
                balance = vals.get('amount', 0.0)
                currency_id = foreign_currency_id
        elif not foreign_currency_id and journal_currency:
            currency_id = journal_currency.id
            amount_currency = vals.get('amount', 0.0)
            balance = journal_currency._convert(amount_currency, journal.company_id.currency_id, journal.company_id, date)
        else:
            currency_id = False
            amount_currency = 0.0
            balance = vals.get('amount', 0.0)

        return {
            'name': vals.get('payment_ref'),
            'partner_id': vals.get('partner_id'),
            'currency_id': currency_id if amount_currency else False,
            'account_id': journal.default_debit_account_id.id if balance >= 0 else journal.default_credit_account_id.id,
            'debit': balance > 0 and balance or 0.0,
            'credit': balance < 0 and -balance or 0.0,
            'amount_currency': amount_currency if currency_id else False,
            'statement_line_id': vals.get('id'),
        }

    @api.model
    def _prepare_counterpart_move_line_vals(self, vals, counterpart_vals, record=None):
        ''' Prepare values to create a new account.move.line record corresponding to the
        counterpart line (having the transfer liquidity account).
        :param vals:                The values used to create the account.bank.statement.line record.
        :param counterpart_vals:    A python dictionary containing:
            'balance':              Optional amount to consider during the reconciliation. If a foreign currency is set on the
                                    counterpart line in the same foreign currency as the statement line, then this amount is
                                    considered as the amount in foreign currency. If not specified, the full balance is took.
                                    This value must be provided if record is not.
            **kwargs:               Additional values that need to land on the account.move.line to create.
        :param record:              An optional account.move.line record representing the counterpart line to reconcile.
        :return:                    The values to create a new account.move.line record.
        '''
        statement = self.env['account.bank.statement'].browse(vals['statement_id'])
        journal = self.env['account.journal'].browse(vals['journal_id'])
        company_currency = journal.company_id.currency_id
        journal_currency = journal.currency_id if journal.currency_id != company_currency else False
        foreign_currency_id = vals.get('foreign_currency_id')
        statement_line_rate = vals.get('amount_currency', 0.0) / (vals.get('amount', 0.0) or 1.0)
        date = vals.get('date', statement.date)
        partner_id = vals.get('partner_id')

        if record and not record.account_id.reconcile:
            raise UserError(_("You can't involve a journal item that uses a not reconcilable account during the reconciliation."))

        if 'currency_id' in counterpart_vals:
            currency_id = counterpart_vals['currency_id']
        elif record:
            currency_id = record.currency_id.id
        else:
            currency_id = foreign_currency_id

        if currency_id:
            if foreign_currency_id and journal_currency:

                # company_currency = currency_1
                # journal_currency = currency_2
                # foreign_currency = currency_3 (could be equals to currency_1)
                # counterpart_currency = currency_4 (could be equals to currency_2 or currency_3)

                if currency_id == foreign_currency_id:
                    amount_currency = counterpart_vals.pop('balance', -record.amount_residual_currency if record else 0.0)
                    balance = journal_currency._convert(amount_currency / statement_line_rate, company_currency, journal.company_id, date)
                elif currency_id == journal_currency.id and foreign_currency_id == company_currency.id:
                    amount_currency = counterpart_vals.pop('balance', -record.amount_residual_currency if record else 0.0)
                    balance = amount_currency * statement_line_rate
                    currency_id = False
                    amount_currency = 0.0
                elif currency_id == journal_currency.id and foreign_currency_id != company_currency.id:
                    amount_currency = counterpart_vals.pop('balance', -record.amount_residual_currency if record else 0.0)
                    balance = journal_currency._convert(amount_currency, company_currency, journal.company_id, date)
                    amount_currency *= statement_line_rate
                    currency_id = foreign_currency_id
                else:
                    balance = counterpart_vals.pop('balance', -record.amount_residual if record else 0.0)
                    amount_currency = company_currency._convert(balance, journal_currency, journal.company_id, date)
                    amount_currency *= statement_line_rate
                    currency_id = foreign_currency_id

            elif foreign_currency_id and not journal_currency:

                # company_currency = currency_1
                # foreign_currency = currency_2
                # counterpart_currency = currency_3 (could be equals to currency_2)

                if currency_id == foreign_currency_id:
                    amount_currency = counterpart_vals.pop('balance', -record.amount_residual_currency if record else 0.0)
                    balance = amount_currency / statement_line_rate
                else:
                    balance = counterpart_vals.pop('balance', -record.amount_residual if record else 0.0)
                    amount_currency = balance * statement_line_rate
                    currency_id = foreign_currency_id

            elif not foreign_currency_id and journal_currency:

                # company_currency = currency_1
                # journal_currency = currency_2
                # counterpart_currency = currency_3 (could be equals to currency_2)

                if currency_id == journal_currency.id:
                    amount_currency = counterpart_vals.pop('balance', -record.amount_residual_currency if record else 0.0)
                    balance = journal_currency._convert(amount_currency, company_currency, journal.company_id, date)
                else:
                    balance = counterpart_vals.pop('balance', -record.amount_residual if record else 0.0)
                    amount_currency = company_currency._convert(balance, journal_currency, journal.company_id, date)
                    currency_id = journal_currency.id

            else:

                # company_currency = currency_1
                # counterpart_currency = currency_2 (could be equals to currency_1)

                balance = counterpart_vals.pop('balance', -record.amount_residual if record else 0.0)
                amount_currency = 0.0
                currency_id = False

        else:
            balance = counterpart_vals.pop('balance', -record.amount_residual if record else 0.0)

            if foreign_currency_id and journal_currency:

                # company_currency = currency_1
                # journal_currency = currency_2
                # foreign_currency = currency_3 (could be equals to currency_1)

                if foreign_currency_id == company_currency.id:
                    amount_currency = 0.0
                else:
                    amount_currency = company_currency._convert(balance, journal_currency, journal.company_id, date)
                    amount_currency *= statement_line_rate
                    currency_id = foreign_currency_id

            elif foreign_currency_id and not journal_currency:

                # company_currency = currency_1
                # foreign_currency = currency_2

                amount_currency = balance * statement_line_rate
                currency_id = foreign_currency_id

            elif not foreign_currency_id and journal_currency:

                # company_currency = currency_1
                # journal_currency = currency_2

                amount_currency = company_currency._convert(balance, journal_currency, journal.company_id, date)
                currency_id = journal_currency.id

            else:

                # Single currency.

                amount_currency = 0.0

        return {
            **counterpart_vals,
            'name': counterpart_vals.get('name', record.name if record else ''),
            'partner_id': partner_id,
            'currency_id': currency_id if amount_currency else False,
            'account_id': counterpart_vals.get('account_id', record.account_id.id if record else False),
            'debit': balance if balance > 0 else 0.0,
            'credit': -balance if balance < 0 else 0.0,
            'amount_currency': amount_currency,
            'statement_line_id': vals.get('id'),
        }

    @api.model
    def _prepare_move_line_default_vals(self, vals):
        ''' Prepare the dictionary to create the default account.move.lines for the current account.bank.statement.line
        record.
        :return: A list of python dictionary to be passed to the account.move.line's 'create' method.
        '''
        journal = self.env['account.journal'].browse(vals['journal_id'])
        self._assert_suspense_account(journal)

        liquidity_line_vals = self._prepare_liquidity_move_line_vals(vals)

        counterpart_vals = {
            'name': vals.get('payment_ref'),
            'account_id': journal.suspense_account_id.id,
        }

        if liquidity_line_vals['currency_id']:
            # Ensure the counterpart will have a balance exactly equals to the amount in journal currency.
            # This avoid some rounding issues when the currency rate between two currencies is not symmetrical.
            # E.g:
            # A.convert(amount_a, B) = amount_b
            # B.convert(amount_b, A) = amount_c != amount_a

            counterpart_vals.update({
                'currency_id': liquidity_line_vals['currency_id'],
                'balance': -liquidity_line_vals['amount_currency'],
            })
        else:
            counterpart_vals['balance'] = liquidity_line_vals['credit'] - liquidity_line_vals['debit']

        counterpart_line_vals = self._prepare_counterpart_move_line_vals(vals, counterpart_vals)
        return [liquidity_line_vals, counterpart_line_vals]

    def _convert_to_dict(self):
        ''' As some method are working both in api.model / api.multi, this helper is used
        to turn the current statement line into a python dictionary and then, to be able
        to call such api.model methods easily.
        :return: a python dictionary representing the current account.bank.statement.line record.
        '''
        self.ensure_one()
        return {
            'id': self.id,
            'statement_id': self.statement_id.id,
            'journal_id': self.journal_id.id,
            'partner_id': self.partner_id.id,
            'amount': self.amount,
            'amount_currency': self.amount_currency,
            'payment_ref': self.payment_ref,
            'date': self.date,
            'foreign_currency_id': self.foreign_currency_id.id,
        }

    # -------------------------------------------------------------------------
    # COMPUTE METHODS
    # -------------------------------------------------------------------------

    @api.depends('move_id.line_ids')
    def _compute_is_reconciled(self):
        ''' Compute the field indicating if the statement lines are already reconciled with something.
        This field is used for display purpose (e.g. display the 'cancel' button on the statement lines).
        '''
        for st_line in self:
            liquidity_lines, suspense_lines, other_lines = st_line._seek_for_lines()

            if st_line.currency_id.is_zero(st_line.amount):
                st_line.is_reconciled = True
            elif not st_line.id or suspense_lines:
                # New record: The journal items are not yet there.
                st_line.is_reconciled = False
            else:
                # The journal entry seems reconciled.
                st_line.is_reconciled = True

    @api.depends('journal_id',
                 'move_id.line_ids.name', 'move_id.line_ids.balance', 'move_id.line_ids.amount_currency',
                 'move_id.line_ids.currency_id', 'move_id.line_ids.partner_id',
                 'move_id.line_ids.account_id.internal_type')
    def _compute_from_move_lines(self):
        ''' Since the user is free to edit the statement line or the journal entry like he want, the statement line
        fields are compute/inverse from the journal items and then, we need to synchronize both models to stay in a
        consistent state.
        This method is the compute updating the statement line regarding its journal entry.
        '''
        for st_line in self:
            liquidity_lines, suspense_lines, other_lines = st_line._seek_for_lines()
            counterpart_lines = suspense_lines + other_lines
            company_currency = st_line.journal_id.company_id.currency_id
            journal_currency = st_line.journal_id.currency_id if st_line.journal_id.currency_id != company_currency else False

            if len(liquidity_lines) == 1:
                st_line.payment_ref = liquidity_lines.name
                st_line.partner_id = liquidity_lines.partner_id
            else:
                st_line.payment_ref = st_line.payment_ref
                st_line.partner_id = st_line.partner_id
                st_line.amount = st_line.amount

            if len(counterpart_lines) == 1:
                if counterpart_lines.currency_id:
                    if st_line.foreign_currency_id and journal_currency:

                        # company_currency = currency_1
                        # journal_currency = currency_2
                        # foreign_currency = currency_3 (could be equals to currency_1)

                        st_line.amount = liquidity_lines.amount_currency if len(liquidity_lines) == 1 else 0.0
                        if counterpart_lines.currency_id == st_line.foreign_currency_id and st_line.foreign_currency_id == company_currency:
                            st_line.amount_currency = -counterpart_lines.balance
                            st_line.foreign_currency_id = company_currency
                        elif counterpart_lines.currency_id == st_line.foreign_currency_id and st_line.foreign_currency_id != company_currency:
                            st_line.amount_currency = -counterpart_lines.amount_currency
                            st_line.foreign_currency_id = counterpart_lines.currency_id
                        elif counterpart_lines.currency_id == journal_currency:
                            st_line.amount_currency = st_line.amount_currency
                            st_line.foreign_currency_id = st_line.foreign_currency_id
                        else:
                            st_line.amount_currency = counterpart_lines.amount_currency
                            st_line.foreign_currency_id = counterpart_lines.foreign_currency_id

                    elif not st_line.foreign_currency_id and journal_currency:

                        # company_currency = currency_1
                        # journal_currency = currency_2

                        st_line.amount = liquidity_lines.amount_currency if len(liquidity_lines) == 1 else 0.0
                        st_line.amount_currency = 0.0
                        st_line.foreign_currency_id = False

                    else:

                        # company_currency = currency_1
                        # foreign_currency = currency_2 (could be equals to currency_1)

                        st_line.amount_currency = -counterpart_lines.amount_currency
                        st_line.foreign_currency_id = counterpart_lines.currency_id
                        st_line.amount = liquidity_lines.balance if len(liquidity_lines) == 1 else 0.0

                else:

                    # The counterpart line doesn't have a foreign currency.

                    if st_line.foreign_currency_id and journal_currency and st_line.foreign_currency_id == company_currency:

                        # company_currency = currency_1
                        # journal_currency = currency_2
                        # foreign_currency = currency_1

                        st_line.amount = liquidity_lines.amount_currency if len(liquidity_lines) == 1 else 0.0
                        st_line.amount_currency = -counterpart_lines.balance
                        st_line.foreign_currency_id = st_line.foreign_currency_id

                    elif journal_currency:

                        # company_currency = currency_1
                        # journal_currency = currency_2

                        st_line.amount = liquidity_lines.amount_currency if len(liquidity_lines) == 1 else 0.0
                        st_line.amount_currency = 0.0
                        st_line.foreign_currency_id = False

                    else:

                        # Single currency.

                        st_line.amount = liquidity_lines.balance if len(liquidity_lines) == 1 else 0.0
                        st_line.amount_currency = 0.0
                        st_line.foreign_currency_id = False
            else:

                # The statement line seems to be already reconciled. Then, don't override the foreign currency data.

                st_line.amount_currency = st_line.amount_currency
                st_line.foreign_currency_id = st_line.foreign_currency_id

    def _inverse_amounts(self):
        ''' Triggered when writing the 'amount' field.
        This field correspond to the 'balance' field in the journal items in case of missing foreign currency on the
        journal. Otherwise, 'amount' is took as the foreign currency and then, is written on the 'amount_currency'
        field on the journal items.
        '''
        for st_line in self:
            liquidity_lines, suspense_lines, other_lines = st_line._seek_for_lines()
            counter_part_lines = suspense_lines + other_lines

            if len(liquidity_lines) != 1 or len(counter_part_lines) != 1:
                raise UserError(_("The journal entry has been manually edited and then, isn't longer recognized as a valid statement line."))

            line_vals_list = self._prepare_move_line_default_vals(st_line._convert_to_dict())
            line_ids_commands = [
                (1, liquidity_lines.id, {k: v for k, v in line_vals_list[0].items() if k in ('debit', 'credit', 'currency_id', 'amount_currency')}),
                (1, counter_part_lines.id, {k: v for k, v in line_vals_list[1].items() if k in ('debit', 'credit', 'currency_id', 'amount_currency')}),
            ]

            st_line.move_id.write({'line_ids': line_ids_commands})

    def _inverse_payment_ref(self):
        for st_line in self:
            liquidity_lines, suspense_lines, other_lines = st_line._seek_for_lines()
            (liquidity_lines + suspense_lines).write({'name': st_line.payment_ref})

    def _inverse_partner_id(self):
        for st_line in self:
            st_line.line_ids.write({'partner_id': st_line.partner_id.id})

    # -------------------------------------------------------------------------
    # CONSTRAINS METHODS
    # -------------------------------------------------------------------------

    @api.constrains('amount', 'amount_currency', 'currency_id', 'foreign_currency_id', 'journal_id')
    def _check_amounts_currencies(self):
        ''' Ensure the consistency the specified amounts and the currencies. '''
        for st_line in self:
            if st_line.journal_id != st_line.statement_id.journal_id:
                raise ValidationError(_('The journal of a statement line must always be the same as the bank statement one.'))
            if st_line.currency_id.is_zero(st_line.amount):
                raise ValidationError(_("The amount of a statement line can't be equal to zero."))
            if st_line.foreign_currency_id == st_line.currency_id:
                raise ValidationError(_("The foreign currency must be different than the journal one: %s") % st_line.currency_id.name)
            if st_line.foreign_currency_id and st_line.foreign_currency_id.is_zero(st_line.amount_currency):
                raise ValidationError(_("The amount in foreign currency must be set if the amount is not equal to zero."))
            if not st_line.foreign_currency_id and st_line.amount_currency:
                raise ValidationError(_("You can't provide an amount in foreign currency without specifying a foreign currency."))

    def _is_account_move_valid(self):
        ''' Method triggered manually when writing on journal entries linked to
        the statement lines through the _inherits to detect some unconsistencies
        between both models.
        :return True if the modifications are valid, False otherwise.
        '''
        for st_line in self:
            move = st_line.move_id
            liquidity_lines, suspense_lines, other_lines = st_line._seek_for_lines()

            if st_line.state == 'open' and move.state != 'draft':
                return False
            if st_line.state == 'posted' and move.state != 'posted':
                return False
            if len(liquidity_lines) != 1:
                return False
        return True

    # -------------------------------------------------------------------------
    # LOW-LEVEL METHODS
    # -------------------------------------------------------------------------

    @api.model_create_multi
    def create(self, vals_list):
        # OVERRIDE
        for vals in vals_list:
            statement = self.env['account.bank.statement'].browse(vals['statement_id'])
            if statement.state != 'open' and self._context.get('check_move_validity', True):
                raise UserError(_("You can only create statement line in open bank statements."))

            journal = statement.journal_id
            # Ensure the journal is the same as the statement one.
            vals['journal_id'] = journal.id
            vals['currency_id'] = (journal.currency_id or journal.company_id.currency_id).id
            if 'date' not in vals:
                vals['date'] = statement.date
            # Create two default account.move.lines for each statement line.
            if 'line_ids' not in vals:
                vals['line_ids'] = [(0, 0, line_vals) for line_vals in self._prepare_move_line_default_vals(vals)]
        st_lines = super().create(vals_list)
        for st_line in st_lines:
            st_line.line_ids.write({'statement_line_id': st_line.id})
        # Call the compute explicitly. This is required because '_compute_from_move_lines' is called by the orm before
        # creating the account.move.lines.
        st_lines._compute_from_move_lines()
        return st_lines

    def unlink(self):
        # OVERRIDE to unlink the inherited account.move (move_id field) as well.
        moves = self.with_context(force_delete=True).mapped('move_id')
        res = super().unlink()
        moves.unlink()
        return res

    # -------------------------------------------------------------------------
    # RECONCILIATION METHODS
    # -------------------------------------------------------------------------

    def _prepare_reconciliation(self, lines_vals_list):
        ''' Helper for the "reconcile" method used to get a full preview of the reconciliation result. This method is
        quite useful to deal with reconcile models or the reconciliation widget because it ensures the values seen by
        the user are exactly the values you get after reconciling.

        :param lines_vals_list: See the 'reconcile' method.
        :return: The diff to be applied on the statement line as a tuple
        (
            to_create:          The values to create the account.move.line on the statement line.
            open_balance_vals:  A dictionary to create the open-balance line or None if the reconciliation is full.
            existing_lines:     The counterpart lines to which the reconciliation will be done.
        )
        '''
        self.ensure_one()

        liquidity_lines, suspense_lines, other_lines = self._seek_for_lines()
        if not self.move_id.to_check and other_lines:
            raise UserError(_("The statement line has already been reconciled."))

        st_line_vals = self._convert_to_dict()
        to_create = []
        total_balance = liquidity_lines.balance
        sequence = 10

        to_browse_ids = []
        to_process_vals = []

        # Step 1: Split 'lines_vals_list' into two batches:
        # - The existing account.move.lines that need to be reconciled with the statement line.
        #       => Will be managed at step 2.
        # - The account.move.lines to be created from scratch.
        #       => Will be managed directly.

        for vals in lines_vals_list:
            # Don't modify the params directly.
            vals = dict(vals)

            if 'id' in vals:
                # Existing account.move.line.
                to_browse_ids.append(vals.pop('id'))
                to_process_vals.append(vals)
            else:
                # Newly created account.move.line from scratch.
                sequence += 1
                vals['sequence'] = sequence
                line_vals = self._prepare_counterpart_move_line_vals(st_line_vals, vals)
                total_balance += line_vals['debit'] - line_vals['credit']
                to_create.append(line_vals)

        # Step 2: Browse counterpart lines all in one and process them.

        existing_lines = self.env['account.move.line'].browse(to_browse_ids)
        for line, vals in zip(existing_lines, to_process_vals):
            sequence += 1
            vals['sequence'] = sequence
            line_vals = self._prepare_counterpart_move_line_vals(st_line_vals, vals, record=line)
            total_balance += line_vals['debit'] - line_vals['credit']
            to_create.append(line_vals)

        # Step 3: If the journal entry is not yet balanced, create an open balance.

        if self.company_currency_id.round(total_balance):
            if self.amount > 0:
                open_balance_account = self.partner_id.property_account_receivable_id
            else:
                open_balance_account = self.partner_id.property_account_payable_id

            open_balance_vals = self._prepare_counterpart_move_line_vals(st_line_vals, {
                'name': '%s: %s' % (self.payment_ref, _('Open Balance')),
                'account_id': open_balance_account.id,
                'balance': -total_balance,
                'currency_id': False,
                'sequence': sequence + 1,
            })
        else:
            open_balance_vals = None

        return to_create, open_balance_vals, existing_lines

    def reconcile(self, lines_vals_list, to_check=False):
        ''' Perform a reconciliation on the current account.bank.statement.line with some
        counterpart account.move.line.
        If the statement line entry is not fully balanced after the reconciliation, an open balance will be created
        using the partner.

        :param lines_vals_list: A list of python dictionary containing:
            'id':               Optional id of an existing account.move.line.
                                For each line having an 'id', a new line will be created in the current statement line.
            'balance':          Optional amount to consider during the reconciliation. If a foreign currency is set on the
                                counterpart line in the same foreign currency as the statement line, then this amount is
                                considered as the amount in foreign currency. If not specified, the full balance is took.
                                This value must be provided if 'id' is not.
            **kwargs:           Custom values to be set on the newly created account.move.line.
        :param to_check:        Mark the current statement line as "to_check" (see field for more details).
        '''
        self.ensure_one()

        # Create a res.partner.bank record if not already set on the statement line but
        # specified in the 'account_number' field.
        if self.account_number and self.partner_id and not self.bank_account_id:
            self.bank_account_id = self._find_or_create_bank_account()

        to_create, open_balance_vals, existing_lines = self._prepare_reconciliation(lines_vals_list)

        # Check the open-balance.
        if open_balance_vals:
            if not open_balance_vals.get('partner_id'):
                raise UserError(_("Unable to create an open balance for a statement line without a partner set."))
            if not open_balance_vals.get('account_id'):
                raise UserError(
                    _("Unable to create an open balance for a statement line because the receivable / payable accounts "
                      "are missing on the partner.")
                )
            to_create.append(open_balance_vals)

        liquidity_lines, suspense_lines, other_lines = self._seek_for_lines()
        to_create_commands = [(0, 0, line_vals) for line_vals in to_create]
        to_delete_commands = [(2, line.id) for line in suspense_lines + other_lines]

        self.move_id.write({
            'line_ids': to_delete_commands + to_create_commands,
            'to_check': to_check,
        })

        for existing_line in existing_lines:
            counterpart_line = self.move_id.line_ids.filtered(lambda line: line.account_id == existing_line.account_id and not line.reconciled)[0]
            (existing_line + counterpart_line).reconcile()

            # Update the payment date to match the current bank statement line's date.
            if existing_line.payment_id:
                existing_line.payment_id.payment_date = self.date

    # -------------------------------------------------------------------------
    # BUSINESS METHODS
    # -------------------------------------------------------------------------

    def _find_or_create_bank_account(self):
        bank_account = self.env['res.partner.bank'].search(
            [('company_id', '=', self.company_id.id), ('acc_number', '=', self.account_number)])
        if not bank_account:
            bank_account = self.env['res.partner.bank'].create({
                'acc_number': self.account_number,
                'partner_id': self.partner_id.id,
                'company_id': self.company_id.id,
            })
        return bank_account

    def button_undo_reconciliation(self):
        ''' Undo the reconciliation mades on the statement line and reset their journal items
        to their original states.
        '''
        for st_line in self:
            move = st_line.move_id
            move_state = move.state

            # Use 'check_move_validity' to avoid the check on consistency between the journal entries and
            # the statement lines.

            # Process only posted & draft moves.
            if move_state == 'posted':
                move.with_context(check_move_validity=False).button_draft()
            elif move_state != 'draft':
                continue

            st_line.move_id.with_context(check_move_validity=False).write({
                'to_check': False,
                'line_ids': [(5, 0)] + [(0, 0, line_vals) for line_vals in self._prepare_move_line_default_vals(st_line._convert_to_dict())],
            })

            if move_state == 'posted':
                move.post()

            move._check_balanced()
