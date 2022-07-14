# -*- coding: utf-8 -*-

from odoo import api, fields, models, _
from odoo.tools import float_is_zero, html2plaintext
from odoo.tools.misc import formatLang, format_date
from odoo.exceptions import UserError, ValidationError
from odoo.osv import expression
from odoo.addons.base.models.res_bank import sanitize_account_number

import datetime


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
    _rec_name = 'id'

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
            result.append((cashbox.id, str(cashbox.total)))
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
            #todo: move difference calcualtion to here
            self.env['account.bank.statement'].browse(bnk_stmt_id).button_validate()
        return {'type': 'ir.actions.act_window_close'}


class AccountBankStatement(models.Model):
    _name = "account.bank.statement"
    _description = "Bank Statement"
    _order = "date desc, name desc, id desc"
    _inherit = ['mail.thread', 'sequence.mixin']
    _check_company_auto = True
    _sequence_index = "journal_id"

    @api.model
    def default_get(self, fields):
        # OVERRIDE
        defaults = super().default_get(fields)
        if self.env.context.get('from_kanban_card'):
            st_line = self.env['account.bank.statement.line'].browse(self.env.context.get('active_id'))
            preceding_statement_last_line = st_line._get_preceding_statement_last_line()

            lines_in_between = self.env['account.bank.statement.line'].search(
                st_line._get_preceding_lines_domain() +
                preceding_statement_last_line._get_succeeding_lines_domain(default_journal_id=st_line.journal_id.id),
            )
            defaults['balance_end_real'] = preceding_statement_last_line.statement_id.balance_end_real + \
                                           sum((lines_in_between + st_line).mapped('amount'))
            defaults['theoretical_balance'] = st_line.cumulative_balance

        return defaults

    @api.depends('line_ids', 'line_ids.amount')
    def _compute_total_entry_encoding(self):
        for statement in self:
            statement.total_entry_encoding = sum(statement.line_ids.mapped('amount'))

    @api.depends('first_line_id.cumulative_balance', 'first_line_id.amount', 'last_line_id.cumulative_balance')
    def _compute_balance(self):
        for statement in self:
            statement.balance_start = statement.first_line_id.cumulative_balance - statement.first_line_id.amount
            statement.balance_end = statement.last_line_id.cumulative_balance

    @api.depends('balance_end_real', 'balance_end', 'currency_id')
    def _compute_difference(self):
        for statement in self:
            statement.difference = statement.balance_end_real - statement.balance_end
            statement.is_difference_zero = statement.currency_id and statement.currency_id.is_zero(statement.difference)

    @api.depends('journal_id')
    def _compute_currency(self):
        for statement in self:
            statement.currency_id = statement.journal_id.currency_id or statement.company_id.currency_id

    @api.depends('line_ids.journal_id')
    def _compute_journal_id(self):
        for statement in self:
            statement.journal_id = statement.line_ids.journal_id[:1]

    @api.depends('move_line_ids')
    def _get_move_line_count(self):
        for statement in self:
            statement.move_line_count = len(statement.move_line_ids)

    name = fields.Char(string='Reference', states={'open': [('readonly', False)]}, copy=False, readonly=True)
    reference = fields.Char(string='External Reference', states={'open': [('readonly', False)]}, copy=False, readonly=True, help="Used to hold the reference of the external mean that created this statement (name of imported file, reference of online synchronization...)")
    date = fields.Date(related='last_line_id.date', store=True)
    date_done = fields.Datetime(string="Closed On")
    balance_start = fields.Monetary(
        string='Computed Starting Balance',
        states={'confirm': [('readonly', True)]},
        compute='_compute_balance',
        store=True,
    )
    balance_start_real = fields.Monetary(
        string='Starting Balance',
        states={'confirm': [('readonly', True)]},
    )
    balance_end_real = fields.Monetary(
        string='Ending Balance',
    )
    is_valid = fields.Boolean(compute='_compute_validity_and_error_message', store=True)
    error_message = fields.Text(compute='_compute_validity_and_error_message', store=True)
    state = fields.Selection(string='Status', required=True, readonly=True, copy=False, tracking=True, selection=[
            ('open', 'New'),
            ('posted', 'Processing'),
            ('confirm', 'Validated'),
        ], default='open',
        help="The current state of your bank statement:"
             "- New: Fully editable with draft Journal Entries."
             "- Processing: No longer editable with posted Journal entries, ready for the reconciliation."
             "- Validated: All lines are reconciled. There is nothing left to process.")

    currency_id = fields.Many2one('res.currency', compute='_compute_currency', string="Currency")
    journal_id = fields.Many2one(
        comodel_name='account.journal',
        compute='_compute_journal_id',
        store=True,
        check_company=True,
    )
    journal_type = fields.Selection(related='journal_id.type', help="Technical field used for usability purposes")
    company_id = fields.Many2one('res.company', related='journal_id.company_id', string='Company', store=True, readonly=True)

    total_entry_encoding = fields.Monetary(
        string='Transactions Subtotal',
        compute='_compute_total_entry_encoding',
        store=True,
        help="Total of transaction lines."
    )
    # Display field for the theoretical balance based on the selected line in the kanban view in the minimal form view.
    theoretical_balance = fields.Monetary(
        readonly=True,
        store=False,
        )
    balance_end = fields.Monetary(
        string='Computed Balance',
        compute='_compute_balance',
        store=True,
        help='Balance as calculated based on Opening Balance and transaction lines'
    )
    difference = fields.Monetary(
        compute='_compute_difference',
        store=True,
        help="Difference between the computed ending balance and the specified ending balance."
    )

    line_ids = fields.One2many(
        comodel_name='account.bank.statement.line',
        inverse_name='statement_id',
        string='Statement lines',
        required=True,
    )
    first_line_id = fields.Many2one(
        comodel_name='account.bank.statement.line',
        compute='_compute_first_last_line',
        store=True
    )
    last_line_id = fields.Many2one(
        comodel_name='account.bank.statement.line',
        compute='_compute_first_last_line',
        store=True
    )

    move_line_ids = fields.One2many('account.move.line', 'statement_id', string='Entry lines', states={'confirm': [('readonly', True)]})
    move_line_count = fields.Integer(compute="_get_move_line_count")

    all_lines_reconciled = fields.Boolean(compute='_compute_all_lines_reconciled',
        help="Technical field indicating if all statement lines are fully reconciled.")
    user_id = fields.Many2one('res.users', string='Responsible', required=False, default=lambda self: self.env.user)
    cashbox_start_id = fields.Many2one('account.bank.statement.cashbox', string="Starting Cashbox")
    cashbox_end_id = fields.Many2one('account.bank.statement.cashbox', string="Ending Cashbox")
    is_difference_zero = fields.Boolean(
        compute='_compute_difference',
        string='Is zero',
        store=True,
        help="Check if difference is zero."
    )
    attachment = fields.Binary()
    country_code = fields.Char(related='company_id.account_fiscal_country_id.code')

    @api.depends('line_ids.is_reconciled')
    def _compute_all_lines_reconciled(self):
        for statement in self:
            statement.all_lines_reconciled = all(st_line.is_reconciled for st_line in statement.line_ids)

    @api.depends('line_ids.date', 'line_ids.sequence', 'line_ids')
    def _compute_first_last_line(self):
        for statement in self:
            sorted_lines = statement.line_ids.sorted()
            statement.first_line_id = sorted_lines[-1:]
            statement.last_line_id = sorted_lines[:1]

    @api.depends('balance_start', 'balance_end',
                 'balance_start_real', 'balance_end_real',
                 'line_ids.previous_line_id', 'line_ids.previous_line_id.statement_id',
                 'line_ids.previous_line_id.statement_id.balance_end_real',
                 'total_entry_encoding', 'is_difference_zero',
                 )
    def _compute_validity_and_error_message(self):
        """
        Finds missing info in the statement.
        - is_gap_before: If there are line with no statement before current statement
        - is_line_missing_before: If there are no line with no statement before current statement,
          but the current statement real start balance does not match the last statement real end balance
        - is_line_missing_beginning: If the calculated start balance (from the first line cumulative balance)
            does not match the statement real start balance, it means some lines are not entered/connected
            before the first line of this statement.
        - is_gap_middle: If there are lines between start and end of this statement that are
          not connected to this statement
        - is_line_missing_middle: If there is no gap in the middle but sum of all lines is not equal to
          the statement real balance
        - is_line_missing_end: If the last line cumulative balance does not match the statement real end balance
        """
        for st in self:
            if not st.line_ids:
                st.is_valid = False
                st.error_message = _('No statement line.')
                continue
            is_gap_before = st.first_line_id.previous_line_id and not st.first_line_id.previous_line_id.statement_id
            is_line_missing_before = not is_gap_before and st.currency_id.compare_amounts(
                                            st.balance_start_real, st.first_line_id.previous_line_id.statement_id.balance_end_real
                                        )
            is_line_missing_beginning = not is_line_missing_before and st.balance_start != st.balance_start_real
            is_gap_middle = any(
                line.previous_line_id.statement_id != st._origin
                for line in (st.line_ids - st.first_line_id)
            )
            is_line_missing_middle = not is_gap_middle \
                                     and sum(st.line_ids.mapped('amount')) != (st.balance_end_real - st.balance_start_real)
            message = []
            if is_gap_before:
                message.append(_('- There are some lines with no statement before this statement.'))
            if is_line_missing_before:
                message.append(_('- The real start balance of this statement does not match the last statement real'
                                 ' end balance. it means some statements are not entered before this statement or '
                                 'the real start balance is not correct.'))
            if is_line_missing_beginning:
                message.append(_('- The calculated start balance (from the first line cumulative balance) does not '
                                 'match the statement real start balance, it means some lines are not entered/connected'
                                 ' before the first line of this statement or the real start balance is not correct.'))
            if is_gap_middle:
                message.append(_('- There are statement lines between the start and end of this statement that are not'
                                 ' connected to this statement.'))
            if is_line_missing_middle:
                message.append(_('- The sum of all lines is not equal to the statement real balance, you should '
                                 'check if there are some lines that are not entered in this statement yet or '
                                 'either the real start/end balances are not correct.'))
            if not st.is_difference_zero:
                message.append(_('- The statement has a difference between the calculated and real end balances.'))
            if message:
                if is_line_missing_before:
                    message.append(_('Last statement: %s', st.first_line_id.previous_line_id.statement_id.display_name))
                    message.append(_('Last statement ending balance: %s',
                                     formatLang(self.env, st.first_line_id.previous_line_id.statement_id.balance_end_real,
                                                currency_obj=st.currency_id)))
                if is_line_missing_beginning or is_line_missing_middle:
                    message.append(_('Calculated start balance: %s', formatLang(self.env, st.balance_start,
                                                                                currency_obj=st.currency_id)))
                if is_line_missing_middle or not st.is_difference_zero:
                    message.append(_('Calculated end balance: %s', formatLang(self.env, st.balance_end,
                                                                              currency_obj=st.currency_id)))

                st.error_message = '\n'.join(message)
                st.is_valid = st.is_difference_zero and not st.currency_id.compare_amounts(
                    st.balance_start_real,
                    st.first_line_id._get_preceding_statement_last_line().statement_id.balance_end_real
                )
            else:
                st.error_message = ''
                st.is_valid = True

    @api.onchange('journal_id')
    def onchange_journal_id(self):
        for st_line in self.line_ids:
            st_line.journal_id = self.journal_id
            st_line.currency_id = self.journal_id.currency_id or self.company_id.currency_id

    def _check_balance_end_real_same_as_computed(self):
        ''' Check the balance_end_real (encoded manually by the user) is equals to the balance_end (computed by odoo).
        In case of a cash statement, the different is set automatically to a profit/loss account.
        '''
        for stmt in self:
            if not stmt.currency_id.is_zero(stmt.difference):
                if stmt.journal_type == 'cash':
                    st_line_vals = {
                        'statement_id': stmt.id,
                        'journal_id': stmt.journal_id.id,
                        'amount': stmt.difference,
                        'date': stmt.date,
                    }

                    if stmt.difference < 0.0:
                        if not stmt.journal_id.loss_account_id:
                            raise UserError(_('Please go on the %s journal and define a Loss Account. This account will be used to record cash difference.', stmt.journal_id.name))

                        st_line_vals['payment_ref'] = _("Cash difference observed during the counting (Loss)")
                        st_line_vals['counterpart_account_id'] = stmt.journal_id.loss_account_id.id
                    else:
                        # statement.difference > 0.0
                        if not stmt.journal_id.profit_account_id:
                            raise UserError(_('Please go on the %s journal and define a Profit Account. This account will be used to record cash difference.', stmt.journal_id.name))

                        st_line_vals['payment_ref'] = _("Cash difference observed during the counting (Profit)")
                        st_line_vals['counterpart_account_id'] = stmt.journal_id.profit_account_id.id

                    self.env['account.bank.statement.line'].create(st_line_vals)
        return True

    @api.ondelete(at_uninstall=False)
    def _unlink_only_if_open(self):
        for statement in self:
            if statement.state != 'open':
                raise UserError(_('In order to delete a bank statement, you must first cancel it to delete related journal items.'))

    # -------------------------------------------------------------------------
    # CONSTRAINT METHODS
    # -------------------------------------------------------------------------

    @api.constrains('journal_id')
    def _check_journal(self):
        for statement in self:
            if any(st_line.journal_id != statement.journal_id for st_line in statement.line_ids):
                raise ValidationError(_('The journal of a bank statement line must always be the same as the bank statement one.'))

    def _constrains_date_sequence(self):
        # Multiple import methods set the name to things that are not sequences:
        # i.e. Statement from {date1} to {date2}
        # It makes this constraint not applicable, and it is less needed on bank statements as it
        # is only an indication and not some thing legal.
        return

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

        self._check_balance_end_real_same_as_computed()

        for statement in self:
            if not statement.name:
                statement._set_next_sequence()

        self.write({'state': 'posted'})
        lines_of_moves_to_post = self.line_ids.filtered(lambda line: line.move_id.state != 'posted')
        if lines_of_moves_to_post:
            lines_of_moves_to_post.move_id._post(soft=False)

    def button_validate(self):
        if any(statement.state != 'posted' or not statement.all_lines_reconciled for statement in self):
            raise UserError(_('All the account entries lines must be processed in order to validate the statement.'))

        for statement in self:

            # Chatter.
            statement.message_post(body=_('Statement %s confirmed.', statement.name))

            # Bank statement report.
            if statement.journal_id.type == 'bank':
                content, content_type = self.env.ref('account.action_report_account_statement')._render(statement.id)
                self.env['ir.attachment'].create({
                    'name': statement.name and _("Bank Statement %s.pdf", statement.name) or _("Bank Statement.pdf"),
                    'type': 'binary',
                    'raw': content,
                    'res_model': statement._name,
                    'res_id': statement.id
                })

        self._check_balance_end_real_same_as_computed()
        self.write({'state': 'confirm', 'date_done': fields.Datetime.now()})

    def button_validate_or_action(self):
        if self.journal_type == 'cash' and not self.currency_id.is_zero(self.difference):
            return self.env['ir.actions.act_window']._for_xml_id('account.action_view_account_bnk_stmt_check')

        return self.button_validate()

    def button_reopen(self):
        ''' Move the bank statements back to the 'open' state. '''
        if any(statement.state != 'confirm' for statement in self):
            raise UserError(_("Only validated statements can be reset to new."))

        self.write({'state': 'open'})
        self.line_ids.move_id.button_draft()
        self.line_ids.button_undo_reconciliation()

    def button_reprocess(self):
        """Move the bank statements back to the 'posted' state."""
        if any(statement.state != 'confirm' for statement in self):
            raise UserError(_("Only Validated statements can be reset to new."))

        self.write({'state': 'posted', 'date_done': False})

    def button_journal_entries(self):
        return {
            'name': _('Journal Entries'),
            'view_mode': 'tree',
            'res_model': 'account.move.line',
            'view_id': self.env.ref('account.view_move_line_tree_grouped_bank_cash').id,
            'type': 'ir.actions.act_window',
            'domain': [('move_id', 'in', self.line_ids.move_id.ids)],
            'context': {
                'journal_id': self.journal_id.id,
                'group_by': 'move_id',
                'expand': True
            }
        }

    def _get_last_sequence_domain(self, relaxed=False):
        self.ensure_one()
        where_string = "WHERE journal_id = %(journal_id)s"
        param = {'journal_id': self.journal_id.id}

        if not relaxed:
            domain = [('journal_id', '=', self.journal_id.id), ('id', '!=', self.id or self._origin.id), ('name', '!=', False)]
            previous_name = self.first_line_id.previous_line_id.statement_id.name
            if not previous_name:
                previous_name = self.search(domain, order='date desc, name', limit=1).name
            sequence_number_reset = self._deduce_sequence_number_reset(previous_name)
            if sequence_number_reset == 'year':
                where_string += " AND date_trunc('year', date) = date_trunc('year', %(date)s) "
                param['date'] = self.date
            elif sequence_number_reset == 'month':
                where_string += " AND date_trunc('month', date) = date_trunc('month', %(date)s) "
                param['date'] = self.date
        return where_string, param

    def _get_starting_sequence(self):
        self.ensure_one()
        return "%s %s %04d/00000" % (self.journal_id.code, _('Statement'), self.date.year)

    @api.model
    def _gc_statements(self):
        self.search([
            ('line_ids', '=', False),
            ('write_date', '<', fields.Date.context_today(self))
        ]).unlink()

    def action_split_or_create(self):
        self.ensure_one()
        st_line = self.env['account.bank.statement.line'].browse(self.env.context.get('active_ids'))
        if st_line.statement_id:
            # split the statement line into multiple statements
            lines = st_line + self.env['account.bank.statement.line'].search(
                st_line._get_succeeding_lines_domain() + [('statement_id', '=', st_line.statement_id.id)],
            )
            total = sum(lines.mapped('amount'))
            lines.statement_id = self
            self.balance_start_real = self.balance_end_real - total
            st_line._get_preceding_statement_last_line().statement_id.balance_end_real -= total
        else:
            # fill the new statement by the statement line and all anterior lines with no statement
            lines = st_line + self.env['account.bank.statement.line'].search(
                st_line._get_preceding_lines_domain() + [('statement_id', '=', False)])
            lines.statement_id = self
            self.balance_start_real = self.balance_end_real - sum(lines.mapped('amount'))
        if not self.name:
            self._set_next_sequence()
        return {'type': 'ir.actions.act_window_close'}

    @api.model_create_multi
    def create(self, vals_list):
        statements = super().create(vals_list)
        for statement in statements.filtered(lambda st: st.journal_id and not st.name):
            statement._set_next_sequence()
        return statements


class AccountBankStatementLine(models.Model):
    _name = "account.bank.statement.line"
    _inherits = {'account.move': 'move_id'}
    _description = "Bank Statement Line"
    _order = "date desc, sequence, id desc"
    _check_company_auto = True

    # FIXME: Fields having the same name in both tables are confusing (partner_id & state). We don't change it because:
    # - It's a mess to track/fix.
    # - Some fields here could be simplified when the onchanges will be gone in account.move.
    # Should be improved in the future.

    # == Business fields ==
    def default_get(self, fields):
        defaults = super().default_get(fields)
        # override journal_id with the default journal from the move, which is a general journal instead of liquidity
        if 'journal_id' in fields and 'default_journal_id' not in self.env.context:
            defaults['journal_id'] = self._get_default_journal()
        return defaults

    move_id = fields.Many2one(
        comodel_name='account.move',
        auto_join=True,
        string='Journal Entry', required=True, readonly=True, ondelete='cascade',
        check_company=True)
    statement_id = fields.Many2one(
        comodel_name='account.bank.statement',
        string='Statement',
        compute='_compute_statement_id',
        store=True,
        readonly=False,
    )

    sequence = fields.Integer(help="Gives the sequence order when displaying a list of bank statement lines.", default=1)
    account_number = fields.Char(string='Bank Account Number', help="Technical field used to store the bank account number before its creation, upon the line's processing")
    partner_name = fields.Char(
        help="This field is used to record the third party name when importing bank statement in electronic format, "
             "when the partner doesn't exist yet in the database (or cannot be found).")
    transaction_type = fields.Char(string='Transaction Type')
    payment_ref = fields.Char(string='Label')
    amount = fields.Monetary(currency_field='currency_id')
    amount_currency = fields.Monetary(
        string="Amount in Currency",
        currency_field='foreign_currency_id',
        help="The amount expressed in an optional other currency if it is a multi-currency entry.",
    )
    foreign_currency_id = fields.Many2one(
        comodel_name='res.currency',
        string="Foreign Currency",
        help="The optional other currency if it is a multi-currency entry.",
    )
    amount_residual = fields.Float(string="Residual Amount",
        compute="_compute_is_reconciled",
        store=True,
        help="The amount left to be reconciled on this statement line (signed according to its move lines' balance), expressed in its currency. This is a technical field use to speedup the application of reconciliation models.")
    currency_id = fields.Many2one(
        comodel_name='res.currency',
        string='Journal Currency',
        compute='_compute_currency_id',
        store=True,
    )
    partner_id = fields.Many2one(
        comodel_name='res.partner',
        string='Partner', ondelete='restrict',
        domain="['|', ('parent_id','=', False), ('is_company','=',True)]",
        check_company=True
    )
    payment_ids = fields.Many2many(
        comodel_name='account.payment',
        relation='account_payment_account_bank_statement_line_rel',
        string='Auto-generated Payments',
        help="Payments generated during the reconciliation of this bank statement lines.")


    # == Display purpose fields ==
    is_reconciled = fields.Boolean(string='Is Reconciled', store=True,
        compute='_compute_is_reconciled',
        help="Technical field indicating if the statement line is already reconciled.")
    kanban_state = fields.Selection(
        selection=[
            ('draft', 'New'),
            ('posted', 'Validated'),
            ('reconciled', 'Reconciled'),
            ('to_check', 'To Check'),
            ('canceled', 'Cancelled')],
        string='State',
        compute='_compute_kanban_state',
        store=True,
    )
    # state = fields.Selection(related='statement_id.state', string='Status', readonly=True)
    country_code = fields.Char(related='company_id.account_fiscal_country_id.code')

    cumulative_balance = fields.Monetary(
        currency_field='currency_id',
        compute='_compute_cumulative_balance',
        store=True,
        recursive=True,
    )

    previous_line_id = fields.Many2one(
        comodel_name='account.bank.statement.line',
        help='technical field to compute cumulative balance correctly',
        compute='_compute_previous_line_id',
        store=True,
    )
    # -------------------------------------------------------------------------
    # HELPERS
    # -------------------------------------------------------------------------

    def _seek_for_lines(self):
        ''' Helper used to dispatch the journal items between:
        - The lines using the liquidity account.
        - The lines using the transfer account.
        - The lines being not in one of the two previous categories.
        :return: (liquidity_lines, suspense_lines, other_lines)
        '''
        liquidity_lines = self.env['account.move.line']
        suspense_lines = self.env['account.move.line']
        other_lines = self.env['account.move.line']

        for line in self.move_id.line_ids:
            if line.account_id == self.journal_id.default_account_id:
                liquidity_lines += line
            elif line.account_id == self.journal_id.suspense_account_id:
                suspense_lines += line
            else:
                other_lines += line
        return liquidity_lines, suspense_lines, other_lines

    def _prepare_counterpart_amounts_using_st_line_rate(self, currency, balance, amount_currency):
        """ Convert the amounts passed as parameters to the statement line currency using the rates provided by the
        bank. The computed amounts are the one that could be set on the statement line as a counterpart journal item
        to fully paid the provided amounts as parameters.

        :param currency:        The currency in which is expressed 'amount_currency'.
        :param balance:         The amount expressed in company currency. Only needed when the currency passed as
                                parameter is neither the statement line's foreign currency, neither the journal's
                                currency.
        :param amount_currency: The amount expressed in the 'currency' passed as parameter.
        :return:                A python dictionary containing:
            * balance:          The amount to consider expressed in company's currency.
            * amount_currency:  The amount to consider expressed in statement line's foreign currency.
        """
        self.ensure_one()

        journal = self.journal_id
        company_currency = journal.company_id.currency_id
        journal_currency = journal.currency_id or company_currency
        foreign_currency = self.foreign_currency_id or journal_currency or company_currency

        journal_amount = self.amount
        if foreign_currency == journal_currency:
            transaction_amount = journal_amount
        else:
            transaction_amount = self.amount_currency
        if journal_currency == company_currency:
            company_amount = journal_amount
        elif foreign_currency == company_currency:
            company_amount = transaction_amount
        else:
            company_amount = journal_currency._convert(journal_amount, company_currency, journal.company_id, self.date)

        rate_journal2foreign_curr = journal_amount and abs(transaction_amount) / abs(journal_amount)
        rate_comp2journal_curr = company_amount and abs(journal_amount) / abs(company_amount)

        if currency == foreign_currency:
            trans_amount_currency = amount_currency
            if rate_journal2foreign_curr:
                journ_amount_currency = journal_currency.round(trans_amount_currency / rate_journal2foreign_curr)
            else:
                journ_amount_currency = 0.0
            if rate_comp2journal_curr:
                new_balance = company_currency.round(journ_amount_currency / rate_comp2journal_curr)
            else:
                new_balance = 0.0
        elif currency == journal_currency:
            trans_amount_currency = foreign_currency.round(amount_currency * rate_journal2foreign_curr)
            if rate_comp2journal_curr:
                new_balance = company_currency.round(amount_currency / rate_comp2journal_curr)
            else:
                new_balance = 0.0
        else:
            journ_amount_currency = journal_currency.round(balance * rate_comp2journal_curr)
            trans_amount_currency = foreign_currency.round(journ_amount_currency * rate_journal2foreign_curr)
            new_balance = balance

        return {
            'amount_currency': trans_amount_currency,
            'balance': new_balance,
        }

    def _prepare_move_line_default_vals(self, counterpart_account_id=None):
        ''' Prepare the dictionary to create the default account.move.lines for the current account.bank.statement.line
        record.
        :return: A list of python dictionary to be passed to the account.move.line's 'create' method.
        '''
        self.ensure_one()

        if not counterpart_account_id:
            counterpart_account_id = self.journal_id.suspense_account_id.id

        if not counterpart_account_id:
            raise UserError(_(
                "You can't create a new statement line without a suspense account set on the %s journal.",
                self.journal_id.display_name,
            ))

        company_amount, foreign_currency, journal, journal_amount, journal_currency, transaction_amount = self._get_company_amount()

        liquidity_line_vals = {
            'name': self.payment_ref,
            'move_id': self.move_id.id,
            'partner_id': self.partner_id.id,
            'account_id': journal.default_account_id.id,
            'currency_id': journal_currency.id,
            'amount_currency': journal_amount,
            'debit': company_amount > 0 and company_amount or 0.0,
            'credit': company_amount < 0 and -company_amount or 0.0,
        }

        # Create the counterpart line values.
        counterpart_line_vals = {
            'name': self.payment_ref,
            'account_id': counterpart_account_id,
            'move_id': self.move_id.id,
            'partner_id': self.partner_id.id,
            'currency_id': foreign_currency.id,
            'amount_currency': -transaction_amount,
            'debit': -company_amount if company_amount < 0.0 else 0.0,
            'credit': company_amount if company_amount > 0.0 else 0.0,
        }
        return [liquidity_line_vals, counterpart_line_vals]

    def _get_company_amount(self):
        journal = self.journal_id
        company_currency = journal.company_id.currency_id
        journal_currency = journal.currency_id or company_currency
        foreign_currency = self.foreign_currency_id or journal_currency or company_currency
        journal_amount = self.amount
        if foreign_currency == journal_currency:
            transaction_amount = journal_amount
        else:
            transaction_amount = self.amount_currency
        if journal_currency == company_currency:
            company_amount = journal_amount
        elif foreign_currency == company_currency:
            company_amount = transaction_amount
        else:
            company_amount = journal_currency._convert(journal_amount, company_currency, journal.company_id, self.date)
        return company_amount, foreign_currency, journal, journal_amount, journal_currency, transaction_amount

    # -------------------------------------------------------------------------
    # COMPUTE METHODS
    # -------------------------------------------------------------------------

    @api.depends('journal_id')
    def _compute_statement_id(self):
        # todo convert to sql and maybe mix with _compute_currency_id
        for line in self.filtered(lambda l: l.statement_id.journal_id != l.journal_id):
            line.statement_id = self.env['account.bank.statement'].search(
                [
                    ('journal_id', '=', line.journal_id.id),
                    ('is_difference_zero', '=', False),
                    ('line_ids', '!=', False), # we don't want the invisible statements to pop up here
                ],
                limit=1)

    @api.depends('journal_id.currency_id')
    def _compute_currency_id(self):
        for st_line in self:
            st_line.currency_id = st_line.journal_id.currency_id or st_line.company_id.currency_id

    @api.depends('journal_id', 'currency_id', 'amount', 'foreign_currency_id', 'amount_currency',
                 'move_id.to_check',
                 'move_id.line_ids.account_id', 'move_id.line_ids.amount_currency',
                 'move_id.line_ids.amount_residual_currency', 'move_id.line_ids.currency_id',
                 'move_id.line_ids.matched_debit_ids', 'move_id.line_ids.matched_credit_ids')
    def _compute_is_reconciled(self):
        ''' Compute the field indicating if the statement lines are already reconciled with something.
        This field is used for display purpose (e.g. display the 'cancel' button on the statement lines).
        Also computes the residual amount of the statement line.
        '''
        for st_line in self:
            liquidity_lines, suspense_lines, other_lines = st_line._seek_for_lines()

            # Compute residual amount
            if st_line.to_check:
                st_line.amount_residual = -st_line.amount_currency if st_line.foreign_currency_id else -st_line.amount
            elif suspense_lines.account_id.reconcile:
                st_line.amount_residual = sum(suspense_lines.mapped('amount_residual_currency'))
            else:
                st_line.amount_residual = sum(suspense_lines.mapped('amount_currency'))

            # Compute is_reconciled
            if not st_line.id:
                # New record: The journal items are not yet there.
                st_line.is_reconciled = False
            elif suspense_lines:
                # In case of the statement line comes from an older version, it could have a residual amount of zero.
                st_line.is_reconciled = suspense_lines.currency_id.is_zero(st_line.amount_residual)
            elif st_line.currency_id.is_zero(st_line.amount):
                st_line.is_reconciled = True
            else:
                # The journal entry seems reconciled.
                st_line.is_reconciled = True

    @api.depends('date', 'sequence', 'journal_id')
    def _compute_previous_line_id(self):
        for st_line in self._origin:
            st_line.previous_line_id = self.search(st_line._get_preceding_lines_domain(), limit=1)


    @api.depends('previous_line_id.cumulative_balance', 'amount')
    def _compute_cumulative_balance(self):
        for st_line in self:
            st_line.cumulative_balance = st_line.previous_line_id.cumulative_balance + st_line.amount

    @api.depends('is_reconciled', 'state', 'to_check')
    def _compute_kanban_state(self):
        for st_line in self:
            if st_line.to_check:
                st_line.kanban_state = 'to_check'
            elif st_line.is_reconciled:
                st_line.kanban_state = 'reconciled'
            elif st_line.state == 'draft':
                st_line.kanban_state = 'draft'
            elif st_line.state == 'posted':
                st_line.kanban_state = 'posted'
            else:
                st_line.kanban_state = 'canceled'
    # -------------------------------------------------------------------------
    # CONSTRAINT METHODS
    # -------------------------------------------------------------------------

    @api.constrains('amount', 'amount_currency', 'currency_id', 'foreign_currency_id', 'journal_id')
    def _check_amounts_currencies(self):
        ''' Ensure the consistency the specified amounts and the currencies. '''

        for st_line in self:
            if st_line.statement_id and st_line.journal_id != st_line.statement_id.journal_id:
                raise ValidationError(_('The journal of a statement line must always be the same as the bank statement one.'))
            if st_line.foreign_currency_id == st_line.currency_id:
                raise ValidationError(_("The foreign currency must be different than the journal one: %s", st_line.currency_id.name))
            if not st_line.foreign_currency_id and st_line.amount_currency:
                raise ValidationError(_("You can't provide an amount in foreign currency without specifying a foreign currency."))

    # -------------------------------------------------------------------------
    # LOW-LEVEL METHODS
    # -------------------------------------------------------------------------

    @api.model_create_multi
    def create(self, vals_list):
        # OVERRIDE
        counterpart_account_ids = []

        for vals in vals_list:
            # Force the move_type to avoid inconsistency with residual 'default_move_type' inside the context.
            vals['move_type'] = 'entry'

            # Hack to force different account instead of the suspense account.
            counterpart_account_ids.append(vals.pop('counterpart_account_id', None))

            if vals.get('statement_id') and not vals.get('journal_id'):
                statement = self.env['account.bank.statement'].browse(vals['statement_id'])
                if statement.journal_id:
                    vals['journal_id'] = statement.journal_id.id

        st_lines = super().create(vals_list)

        for i, st_line in enumerate(st_lines):
            counterpart_account_id = counterpart_account_ids[i]

            to_write = {'statement_line_id': st_line.id, 'narration': st_line.narration}
            if 'line_ids' not in vals_list[i]:
                to_write['line_ids'] = [(0, 0, line_vals) for line_vals in st_line._prepare_move_line_default_vals(counterpart_account_id=counterpart_account_id)]

            st_line.move_id.write(to_write)

            # Otherwise field narration will be recomputed silently (at next flush) when writing on partner_id
            self.env.remove_to_compute(st_line.move_id._fields['narration'], st_line.move_id)
        st_lines.move_id.action_post()

        to_recompute = self.search([
            ('previous_line_id', 'in', self.ids),
            ('id', 'not in', self.ids),
        ])
        if to_recompute:
            self.env.add_to_compute(self._fields['previous_line_id'], to_recompute)
            to_recompute.modified(['previous_line_id'])

        next_lines_to_recompute = self.search([
            ('previous_line_id', 'in', [line.previous_line_id.id for line in st_lines]),
            ('id', 'not in', st_lines.ids),
        ])
        if next_lines_to_recompute:
            self.env.add_to_compute(self._fields['previous_line_id'], next_lines_to_recompute)
            next_lines_to_recompute.modified(['previous_line_id'])
        return st_lines

    def write(self, values):
        # OVERRIDE
        res = super().write(values)
        self._synchronize_to_moves(set(values.keys()))
        if any(field in values for field in ['date', 'sequence', 'journal_id']):
            # If we are changing the date or journal of a bank statement, we have to change its previous_line_id. 
            # This is done automatically using the compute function, but we also have to change the previous_line_id 
            # of records that were previously pointing toward us and records that were pointing towards our new 
            # previous_line_id. This is done here by marking those record as needing to be recomputed.
            # Note that marking the field is not enough as we also have to recompute all its other fields that
            # depend on 'previous_line_id' hence the need to call modified afterwards.
            to_recompute = self.search([
                ('previous_line_id', 'in', self.ids), 
                ('id', 'not in', self.ids), 
            ])
            if to_recompute:
                self.env.add_to_compute(self._fields['previous_line_id'], to_recompute)
                to_recompute.modified(['previous_line_id'])

            next_lines_to_recompute = self.search([
                ('previous_line_id', 'in', [line.previous_line_id.id for line in self]),
                ('id', 'not in', self.ids), 
            ])

            if next_lines_to_recompute:
                self.env.add_to_compute(self._fields['previous_line_id'], next_lines_to_recompute)
                next_lines_to_recompute.modified(['previous_line_id'])
        return res

    @api.ondelete(at_uninstall=False)
    def _unlink_moves_and_fix_chain_if_not_uninstall(self):
        # if module is not uninstalling, we need to recompute the previous_line_id for the lines after current lines
        for line in self:
            next_line = self.search([('previous_line_id', '=', line.id)], limit=1)
            if next_line:
                next_line.previous_line_id = line.previous_line_id

        # if module is uninstalling, the moves will be unlinked anyway, otherwise we have to unlink them when
        # the related lines are unlinked
        moves = self.with_context(force_delete=True).mapped('move_id')
        moves.unlink()

    # -------------------------------------------------------------------------
    # SYNCHRONIZATION account.bank.statement.line <-> account.move
    # -------------------------------------------------------------------------

    def _synchronize_from_moves(self, changed_fields):
        ''' Update the account.bank.statement.line regarding its related account.move.
        Also, check both models are still consistent.
        :param changed_fields: A set containing all modified fields on account.move.
        '''
        if self._context.get('skip_account_move_synchronization'):
            return

        for st_line in self.with_context(skip_account_move_synchronization=True):
            move = st_line.move_id
            move_vals_to_write = {}
            st_line_vals_to_write = {}

            # todo: check if we can remove this condition as statements doesn't have state anymore
            # if 'state' in changed_fields:
                # if (st_line.state == 'posted' and move.state != 'draft') or (st_line.state in ('posted', 'confirm') and move.state != 'posted'):
                #     raise UserError(_(
                #         "You can't manually change the state of journal entry %s, as it has been created by bank "
                #         "statement %s."
                #     ) % (st_line.move_id.display_name, st_line.statement_id.display_name))

            if 'line_ids' in changed_fields:
                liquidity_lines, suspense_lines, other_lines = st_line._seek_for_lines()
                company_currency = st_line.journal_id.company_id.currency_id
                journal_currency = st_line.journal_id.currency_id if st_line.journal_id.currency_id != company_currency else False

                if len(liquidity_lines) != 1:
                    raise UserError(_(
                        "The journal entry %s reached an invalid state regarding its related statement line.\n"
                        "To be consistent, the journal entry must always have exactly one journal item involving the "
                        "bank/cash account."
                    ) % st_line.move_id.display_name)

                st_line_vals_to_write.update({
                    'payment_ref': liquidity_lines.name,
                    'partner_id': liquidity_lines.partner_id.id,
                })

                # Update 'amount' according to the liquidity line.

                if journal_currency:
                    st_line_vals_to_write.update({
                        'amount': liquidity_lines.amount_currency,
                    })
                else:
                    st_line_vals_to_write.update({
                        'amount': liquidity_lines.balance,
                    })

                if len(suspense_lines) == 1:

                    if journal_currency and suspense_lines.currency_id == journal_currency:

                        # The suspense line is expressed in the journal's currency meaning the foreign currency
                        # set on the statement line is no longer needed.

                        st_line_vals_to_write.update({
                            'amount_currency': 0.0,
                            'foreign_currency_id': False,
                        })

                    elif not journal_currency and suspense_lines.currency_id == company_currency:

                        # Don't set a specific foreign currency on the statement line.

                        st_line_vals_to_write.update({
                            'amount_currency': 0.0,
                            'foreign_currency_id': False,
                        })

                    else:

                        # Update the statement line regarding the foreign currency of the suspense line.

                        st_line_vals_to_write.update({
                            'amount_currency': -suspense_lines.amount_currency,
                            'foreign_currency_id': suspense_lines.currency_id.id,
                        })

                move_vals_to_write.update({
                    'partner_id': liquidity_lines.partner_id.id,
                    'currency_id': (st_line.foreign_currency_id or journal_currency or company_currency).id,
                })

            move.write(move._cleanup_write_orm_values(move, move_vals_to_write))
            st_line.write(move._cleanup_write_orm_values(st_line, st_line_vals_to_write))

    def _synchronize_to_moves(self, changed_fields):
        ''' Update the account.move regarding the modified account.bank.statement.line.
        :param changed_fields: A list containing all modified fields on account.bank.statement.line.
        '''
        if self._context.get('skip_account_move_synchronization'):
            return

        if not any(field_name in changed_fields for field_name in (
            'payment_ref', 'amount', 'amount_currency',
            'foreign_currency_id', 'currency_id', 'partner_id',
        )):
            return

        for st_line in self.with_context(skip_account_move_synchronization=True):
            liquidity_lines, suspense_lines, other_lines = st_line._seek_for_lines()
            company_currency = st_line.journal_id.company_id.currency_id
            journal_currency = st_line.journal_id.currency_id if st_line.journal_id.currency_id != company_currency else False

            line_vals_list = self._prepare_move_line_default_vals()
            line_ids_commands = [(1, liquidity_lines.id, line_vals_list[0])]

            if suspense_lines:
                line_ids_commands.append((1, suspense_lines.id, line_vals_list[1]))
            else:
                line_ids_commands.append((0, 0, line_vals_list[1]))

            for line in other_lines:
                line_ids_commands.append((2, line.id))

            st_line_vals = {
                'currency_id': (st_line.foreign_currency_id or journal_currency or company_currency).id,
                'line_ids': line_ids_commands,
            }
            if st_line.move_id.partner_id != st_line.partner_id:
                st_line_vals['partner_id'] = st_line.partner_id.id
            st_line.move_id.write(st_line_vals)

    # -------------------------------------------------------------------------
    # BUSINESS METHODS
    # -------------------------------------------------------------------------

    def _get_st_line_strings_for_matching(self, allowed_fields=None):
        """ Collect the strings that could be used on the statement line to perform some matching.

        :param allowed_fields: A explicit list of fields to consider.
        :return: A list of strings.
        """
        self.ensure_one()

        def _get_text_value(field_name):
            if self._fields[field_name].type == 'html':
                return self[field_name] and html2plaintext(self[field_name])
            else:
                return self[field_name]

        st_line_text_values = []
        if allowed_fields is None or 'payment_ref' in allowed_fields:
            value = _get_text_value('payment_ref')
            if value:
                st_line_text_values.append(value)
        if allowed_fields is None or 'narration' in allowed_fields:
            value = _get_text_value('narration')
            if value:
                st_line_text_values.append(value)
        if allowed_fields is None or 'ref' in allowed_fields:
            value = _get_text_value('ref')
            if value:
                st_line_text_values.append(value)
        return st_line_text_values

    def _get_default_amls_matching_domain(self):
        return [
            # Base domain.
            ('display_type', 'not in', ('line_section', 'line_note')),
            ('move_id.state', '=', 'posted'),
            ('company_id', '=', self.company_id.id),
            # Reconciliation domain.
            ('reconciled', '=', False),
            ('account_id.reconcile', '=', True),
            # Special domain for payments.
            '|',
            ('account_id.internal_type', 'not in', ('receivable', 'payable')),
            ('payment_id', '=', False),
            # Special domain for statement lines.
            ('statement_line_id', '!=', self.id),
        ]

    def _retrieve_partner(self):
        self.ensure_one()

        # Retrieve the partner from the statement line.
        if self.partner_id:
            return self.partner_id

        # Retrieve the partner from the bank account.
        if self.account_number:
            account_number_nums = sanitize_account_number(self.account_number)
            if account_number_nums:
                domain = [('sanitized_acc_number', 'ilike', account_number_nums)]
                for extra_domain in ([('company_id', '=', self.company_id.id)], []):
                    bank_accounts = self.env['res.partner.bank'].search(extra_domain + domain)
                    if len(bank_accounts.partner_id) == 1:
                        return bank_accounts.partner_id

        # Retrieve the partner from the partner name.
        if self.partner_name:
            domain = [
                ('parent_id', '=', False),
                ('name', 'ilike', self.partner_name),
            ]
            for extra_domain in ([('company_id', '=', self.company_id.id)], []):
                partner = self.env['res.partner'].search(extra_domain + domain, limit=1)
                if partner:
                    return partner

        # Retrieve the partner from the reconcile models.
        rec_models = self.env['account.reconcile.model'].search([
            ('rule_type', '!=', 'writeoff_button'),
            ('company_id', '=', self.company_id.id),
        ])
        for rec_model in rec_models:
            partner = rec_model._get_partner_from_mapping(self)
            if partner and rec_model._is_applicable_for(self, partner):
                return partner

        # Retrieve the partner from statement line text values.
        st_line_text_values = self._get_st_line_strings_for_matching()
        unaccent = expression.get_unaccent_wrapper(self._cr)
        sub_queries = []
        params = []
        for text_value in st_line_text_values:
            if not text_value:
                continue

            # Find a partner having a name contained inside the statement line values.
            # Take care a partner could contain some special characters in its name that needs to be escaped.
            sub_queries.append(rf'''
                {unaccent("%s")} ~* ('^' || (
                   SELECT STRING_AGG(CONCAT('(?=.*\m', chunk[1], '\M)'), '')
                   FROM regexp_matches({unaccent('name')}, '\w{{3,}}', 'g') AS chunk
                ))
            ''')
            params.append(text_value)

        if sub_queries:
            self.env['res.partner'].flush_model(['company_id', 'name'])
            self._cr.execute(
                '''
                    SELECT id
                    FROM res_partner
                    WHERE (company_id IS NULL OR company_id = %s)
                        AND name IS NOT NULL
                        AND (''' + ') OR ('.join(sub_queries) + ''')
                ''',
                [self.company_id.id or self.env.company.id] + params,
            )
            rows = self._cr.fetchall()
            if len(rows) == 1:
                return self.env['res.partner'].browse(rows[0][0])

        return self.env['res.partner']

    def _find_or_create_bank_account(self):
        bank_account = self.env['res.partner.bank'].search([
            ('acc_number', '=', self.account_number),
            ('partner_id', '=', self.partner_id.id),
        ])
        if not bank_account:
            bank_account = self.env['res.partner.bank'].create({
                'acc_number': self.account_number,
                'partner_id': self.partner_id.id,
            })
        return bank_account

    def _get_preceding_lines_domain(self, default_journal_id=False):
        """
        get a domain for acquiring the lines before the current one. Accepts zero or one record
        :return: 
        """
        # we set a default date so it can be directly on search results, regardless of the existance of a line
        date = self.date or datetime.date.max
        return[('journal_id', '=', self.journal_id.id or default_journal_id),
                '|', '|',
                    ('date', '<', date),
                    '&',
                        ('date', '=', date),
                        ('sequence', '>', self.sequence),
                   '&','&',
                        ('date', '=', date),
                        ('sequence', '=', self.sequence),
                        ('id', '<', self.id),
        ]

    def _get_succeeding_lines_domain(self, default_journal_id=False):
        # we set a default date so it can be directly on search results, regardless of the existence of a line
        date = self.date or datetime.date.min
        return[('journal_id', '=', self.journal_id.id or default_journal_id),
                '|', '|',
                    ('date', '>', date),
                    '&',
                        ('date', '=', date),
                        ('sequence', '<', self.sequence),
                   '&','&',
                        ('date', '=', date),
                        ('sequence', '=', self.sequence),
                        ('id', '>', self.id),
        ]

    def _get_preceding_statement_last_line(self):
        """
        get the last line of the preceding statement
        """
        self.ensure_one()
        domain = self._get_preceding_lines_domain() + [
            ('statement_id', '!=', self.statement_id.id), ('statement_id', '!=', False)
        ]
        return self.search(domain, limit=1)


    @api.model
    def _get_default_journal(self):
        journal_type = self.env.context.get('journal_type', 'bank')
        company_id = self.env.company.id
        if journal_type:
            return self.env['account.journal'].search([
                ('type', '=', journal_type),
                ('company_id', '=', company_id)
            ], limit=1)
        return self.env['account.journal']


    def button_undo_reconciliation(self):
        ''' Undo the reconciliation mades on the statement line and reset their journal items
        to their original states.
        '''
        self.line_ids.remove_move_reconcile()
        self.payment_ids.unlink()

        for st_line in self:
            st_line.with_context(force_delete=True).write({
                'to_check': False,
                'line_ids': [(5, 0)] + [(0, 0, line_vals) for line_vals in st_line._prepare_move_line_default_vals()],
            })

    def action_post(self):
        self.move_id.filtered(lambda move: move.state=='draft').action_post()
