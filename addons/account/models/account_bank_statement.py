# -*- coding: utf-8 -*-

from collections import defaultdict

from odoo import Command, api, fields, models, _
from odoo.exceptions import UserError, ValidationError


class AccountBankStatement(models.Model):
    _name = "account.bank.statement"
    _description = "Bank Statement"
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = "last_date desc, date desc, id desc"

    name = fields.Char(
        string="Reference",
        copy=False,
    )
    last_date = fields.Date(
        compute='_compute_last_date',
        store=True,
        help="Technical field holding the date of the last selected transaction for the current statement. "
             "We need that in order to ensure lines are well ordered.",
    )
    date = fields.Date(
        required=True,
        index=True,
        copy=False,
        default=fields.Date.context_today,
    )
    line_ids = fields.One2many(
        string="Statement lines",
        comodel_name='account.bank.statement.line',
        inverse_name='statement_id',
    )
    is_reconciled = fields.Boolean(
        compute='_compute_is_reconciled',
        store=True,
    )
    has_valid_balances = fields.Boolean(
        compute='_compute_has_valid_balances',
        store=True,
    )
    journal_id = fields.Many2one(
        comodel_name='account.journal',
        compute='_compute_journal_id',
        store=True,
    )
    company_id = fields.Many2one(
        related='journal_id.company_id',
        store=True,
    )
    currency_id = fields.Many2one(
        comodel_name='res.currency',
        compute='_compute_currency_id',
        store=True,
    )
    balance_start = fields.Monetary(
        string="Starting Balance",
        copy=False,
        default=lambda self: self._get_default_balances_from_context(self._context.get('default_line_ids'))[0],
    )
    balance_end = fields.Monetary(
        string="Computed Balance",
        compute='_compute_balance_end',
        store=True,
    )
    balance_end_real = fields.Monetary(
        string="Ending Balance",
        copy=False,
        default=lambda self: self._get_default_balances_from_context(self._context.get('default_line_ids'))[1],
    )

    # ==== Reconciliation ====
    nb_lines_to_reconcile = fields.Integer(
        compute='_compute_nb_lines_to_reconcile',
    )

    # -------------------------------------------------------------------------
    # CONSTRAINT METHODS
    # -------------------------------------------------------------------------

    @api.constrains('line_ids')
    def _check_lines_consistency(self):
        for statement in self:
            journals = statement.line_ids.journal_id
            if len(journals) > 1:
                raise ValidationError(_(
                    "All bank transactions belonging to the same bank statement must share the same journal"
                ))

    # -------------------------------------------------------------------------
    # DEFAULT METHODS
    # -------------------------------------------------------------------------

    def _get_default_balances_from_context(self, line_ids_commands):
        balance_start = balance_end = 0.0
        if line_ids_commands:
            st_lines = self.env['account.bank.statement']\
                .new({'line_ids': line_ids_commands})\
                .line_ids
            if st_lines:
                balance_start = st_lines[0].running_balance_end - st_lines[0].amount
                balance_end = balance_start + sum(st_lines.mapped('amount'))

        return balance_start, balance_end

    # -------------------------------------------------------------------------
    # COMPUTE METHODS
    # -------------------------------------------------------------------------

    @api.depends('line_ids.date')
    def _compute_last_date(self):
        for st in self:
            st.last_date = st.line_ids.sorted()[:1].date or st.date

    @api.depends('line_ids.is_reconciled')
    def _compute_is_reconciled(self):
        for st in self:
            st.is_reconciled = all(x.is_reconciled for x in st.line_ids)

    @api.depends('line_ids.journal_id')
    def _compute_journal_id(self):
        for st in self:
            st.journal_id = st.line_ids.journal_id[:1]

    @api.depends('journal_id')
    def _compute_currency_id(self):
        for st in self:
            st.currency_id = st.journal_id.currency_id \
                             or st.journal_id.company_id.currency_id \
                             or self.env.company.currency_id

    @api.depends('balance_start', 'balance_end', 'line_ids.amount')
    def _compute_has_valid_balances(self):
        for st in self:
            st.has_valid_balances = st.currency_id.is_zero(
                st.balance_end - sum(st.line_ids.mapped('amount')) - st.balance_start
            )

    @api.depends('line_ids.state', 'line_ids.is_reconciled')
    def _compute_nb_lines_to_reconcile(self):
        for st in self:
            posted_lines = st.line_ids.filtered(lambda x: x.state == 'posted')
            st.nb_lines_to_reconcile = len(posted_lines) - len(posted_lines.filtered('is_reconciled'))

    @api.depends('balance_start', 'line_ids.amount')
    def _compute_balance_end(self):
        for st in self:
            st.balance_end = st.balance_start + sum(st.line_ids.mapped('amount'))

    # -------------------------------------------------------------------------
    # LOW-LEVEL METHODS
    # -------------------------------------------------------------------------

    @api.depends('date', 'name')
    def name_get(self):
        result = []
        for st in self:
            label = fields.Date.to_string(st.date)
            if st.name:
                label += ': ' + st.name
            result.append((st.id, label))
        return result

    @api.model_create_multi
    def create(self, vals_list):
        # OVERRIDE
        # Fill 'balance_start' / 'balance_end' if not specified.
        for vals in vals_list:
            if all(field_name not in vals for field_name in ('balance_start', 'balance_end')) and 'line_ids' in vals:
                balance_start, balance_end = self._get_default_balances_from_context(vals['line_ids'])
                vals['balance_start'] = balance_start
                vals['balance_end'] = balance_end
        return super().create(vals_list)

    # -------------------------------------------------------------------------
    # BUSINESS METHODS
    # -------------------------------------------------------------------------


class AccountBankStatementLine(models.Model):
    _name = "account.bank.statement.line"
    _inherits = {'account.move': 'move_id'}
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _description = "Bank Statement Line"
    _order = "date desc, statement_id, id desc"
    _check_company_auto = True

    def _get_default_journal(self):
        ''' Retrieve the default journal for the account.payment.
        /!\ This method will not override the method in 'account.move' because the ORM
        doesn't allow overriding methods using _inherits. Then, this method will be called
        manually in 'create' and 'new'.
        :return: An account.journal record.
        '''
        return self.env['account.move']._search_default_journal(('bank', 'cash'))

    # == Business fields ==
    move_id = fields.Many2one(
        comodel_name='account.move',
        string='Journal Entry', required=True, readonly=True, ondelete='cascade',
        check_company=True)
    statement_id = fields.Many2one(
        comodel_name='account.bank.statement',
        string="Bank Statement",
        index=True,
        check_company=True,
    )

    account_number = fields.Char(string='Bank Account Number', help="Technical field used to store the bank account number before its creation, upon the line's processing")
    partner_name = fields.Char(
        help="This field is used to record the third party name when importing bank statement in electronic format, "
             "when the partner doesn't exist yet in the database (or cannot be found).")
    transaction_type = fields.Char(string='Transaction Type')
    payment_ref = fields.Char(string='Label', required=True)
    amount = fields.Monetary(currency_field='currency_id')
    amount_currency = fields.Monetary(currency_field='foreign_currency_id',
        help="The amount expressed in an optional other currency if it is a multi-currency entry.")
    foreign_currency_id = fields.Many2one('res.currency', string='Foreign Currency',
        help="The optional other currency if it is a multi-currency entry.")
    amount_residual = fields.Float(string="Residual Amount",
        compute="_compute_is_reconciled",
        store=True,
        help="The amount left to be reconciled on this statement line (signed according to its move lines' balance), expressed in its currency. This is a technical field use to speedup the application of reconciliation models.")
    currency_id = fields.Many2one(
        comodel_name='res.currency',
        string="Journal Currency",
        store=True,
        readonly=False,
        compute='_compute_currency_id',
    )
    partner_id = fields.Many2one(
        comodel_name='res.partner',
        string='Partner', ondelete='restrict',
        domain="['|', ('parent_id','=', False), ('is_company','=',True)]",
        check_company=True)
    is_reconciled = fields.Boolean(
        string="Is Reconciled",
        store=True,
        compute='_compute_is_reconciled',
        help="Technical field indicating if the statement line is already reconciled.",
    )

    # == Stat buttons ==
    reconciled_move_ids = fields.Many2many(
        comodel_name='account.move',
        string="Reconciled Journal Entries",
        compute='_compute_stat_buttons_from_reconciliation')
    reconciled_move_ids_count = fields.Integer(
        string="# Reconciled Journal Entries",
        compute="_compute_stat_buttons_from_reconciliation")

    # == Running balances ==
    running_balance_end = fields.Monetary(
        string="Running Ending Balance",
        store=False,
        currency_field='currency_id',
        compute='_compute_running_balance_end',
    )

    # == Display purpose fields ==
    country_code = fields.Char(related='company_id.account_fiscal_country_id.code')

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

    @api.model
    def _prepare_liquidity_move_line_vals(self):
        ''' Prepare values to create a new account.move.line record corresponding to the
        liquidity line (having the bank/cash account).
        :return:        The values to create a new account.move.line record.
        '''
        self.ensure_one()

        journal = self.journal_id
        company_currency = journal.company_id.currency_id
        journal_currency = journal.currency_id if journal.currency_id != company_currency else False

        if self.foreign_currency_id and journal_currency:
            currency_id = journal_currency.id
            if self.foreign_currency_id == company_currency:
                amount_currency = self.amount
                balance = self.amount_currency
            else:
                amount_currency = self.amount
                balance = journal_currency._convert(amount_currency, company_currency, journal.company_id, self.date)
        elif self.foreign_currency_id and not journal_currency:
            amount_currency = self.amount_currency
            balance = self.amount
            currency_id = self.foreign_currency_id.id
        elif not self.foreign_currency_id and journal_currency:
            currency_id = journal_currency.id
            amount_currency = self.amount
            balance = journal_currency._convert(amount_currency, journal.company_id.currency_id, journal.company_id, self.date)
        else:
            currency_id = company_currency.id
            amount_currency = self.amount
            balance = self.amount

        return {
            'name': self.payment_ref,
            'move_id': self.move_id.id,
            'partner_id': self.partner_id.id,
            'currency_id': currency_id,
            'account_id': journal.default_account_id.id,
            'debit': balance > 0 and balance or 0.0,
            'credit': balance < 0 and -balance or 0.0,
            'amount_currency': amount_currency,
        }

    @api.model
    def _prepare_counterpart_move_line_vals(self, counterpart_vals, move_line=None):
        ''' Prepare values to create a new account.move.line move_line.
        By default, without specified 'counterpart_vals' or 'move_line', the counterpart line is
        created using the suspense account. Otherwise, this method is also called during the
        reconciliation to prepare the statement line's journal entry. In that case,
        'counterpart_vals' will be used to create a custom account.move.line (from the reconciliation widget)
        and 'move_line' will be used to create the counterpart of an existing account.move.line to which
        the newly created journal item will be reconciled.
        :param counterpart_vals:    A python dictionary containing:
            'balance':                  Optional amount to consider during the reconciliation. If a foreign currency is set on the
                                        counterpart line in the same foreign currency as the statement line, then this amount is
                                        considered as the amount in foreign currency. If not specified, the full balance is took.
                                        This value must be provided if move_line is not.
            'amount_residual':          The residual amount to reconcile expressed in the company's currency.
                                        /!\ This value should be equivalent to move_line.amount_residual except we want
                                        to avoid browsing the record when the only thing we need in an overview of the
                                        reconciliation, for example in the reconciliation widget.
            'amount_residual_currency': The residual amount to reconcile expressed in the foreign's currency.
                                        Using this key doesn't make sense without passing 'currency_id' in vals.
                                        /!\ This value should be equivalent to move_line.amount_residual_currency except
                                        we want to avoid browsing the record when the only thing we need in an overview
                                        of the reconciliation, for example in the reconciliation widget.
            **kwargs:                   Additional values that need to land on the account.move.line to create.
        :param move_line:           An optional account.move.line move_line representing the counterpart line to reconcile.
        :return:                    The values to create a new account.move.line move_line.
        '''
        self.ensure_one()

        journal = self.journal_id
        company_currency = journal.company_id.currency_id
        journal_currency = journal.currency_id or company_currency
        foreign_currency = self.foreign_currency_id or journal_currency or company_currency
        statement_line_rate = (self.amount_currency / self.amount) if self.amount else 0.0

        balance_to_reconcile = counterpart_vals.pop('balance', None)
        amount_residual = -counterpart_vals.pop('amount_residual', move_line.amount_residual if move_line else 0.0) \
            if balance_to_reconcile is None else balance_to_reconcile
        amount_residual_currency = -counterpart_vals.pop('amount_residual_currency', move_line.amount_residual_currency if move_line else 0.0)\
            if balance_to_reconcile is None else balance_to_reconcile

        if 'currency_id' in counterpart_vals:
            currency_id = counterpart_vals['currency_id'] or company_currency.id
        elif move_line:
            currency_id = move_line.currency_id.id or company_currency.id
        else:
            currency_id = foreign_currency.id

        if currency_id not in (foreign_currency.id, journal_currency.id):
            currency_id = company_currency.id
            amount_residual_currency = 0.0

        amounts = {
            company_currency.id: 0.0,
            journal_currency.id: 0.0,
            foreign_currency.id: 0.0,
        }

        amounts[currency_id] = amount_residual_currency
        amounts[company_currency.id] = amount_residual

        if currency_id == journal_currency.id and journal_currency != company_currency:
            if foreign_currency != company_currency:
                amounts[company_currency.id] = journal_currency._convert(amounts[currency_id], company_currency, journal.company_id, self.date)
            if statement_line_rate:
                amounts[foreign_currency.id] = amounts[currency_id] * statement_line_rate
        elif currency_id == foreign_currency.id and self.foreign_currency_id:
            if statement_line_rate:
                amounts[journal_currency.id] = amounts[foreign_currency.id] / statement_line_rate
                if foreign_currency != company_currency:
                    amounts[company_currency.id] = journal_currency._convert(amounts[journal_currency.id], company_currency, journal.company_id, self.date)
        else:
            amounts[journal_currency.id] = company_currency._convert(amounts[company_currency.id], journal_currency, journal.company_id, self.date)
            if statement_line_rate:
                amounts[foreign_currency.id] = amounts[journal_currency.id] * statement_line_rate

        if foreign_currency == company_currency and journal_currency != company_currency and self.foreign_currency_id:
            balance = amounts[foreign_currency.id]
        else:
            balance = amounts[company_currency.id]

        if foreign_currency != company_currency and self.foreign_currency_id:
            amount_currency = amounts[foreign_currency.id]
            currency_id = foreign_currency.id
        elif journal_currency != company_currency and not self.foreign_currency_id:
            amount_currency = amounts[journal_currency.id]
            currency_id = journal_currency.id
        else:
            amount_currency = amounts[company_currency.id]
            currency_id = company_currency.id

        return {
            **counterpart_vals,
            'name': counterpart_vals.get('name', move_line.name if move_line else ''),
            'move_id': self.move_id.id,
            'partner_id': self.partner_id.id or (move_line.partner_id.id if move_line else False),
            'currency_id': currency_id,
            'account_id': counterpart_vals.get('account_id', move_line.account_id.id if move_line else False),
            'debit': balance if balance > 0.0 else 0.0,
            'credit': -balance if balance < 0.0 else 0.0,
            'amount_currency': amount_currency,
        }

    @api.model
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
                "You can't create a new statement line without a suspense account set on the %s journal."
            ) % self.journal_id.display_name)

        liquidity_line_vals = self._prepare_liquidity_move_line_vals()

        # Ensure the counterpart will have a balance exactly equals to the amount in journal currency.
        # This avoid some rounding issues when the currency rate between two currencies is not symmetrical.
        # E.g:
        # A.convert(amount_a, B) = amount_b
        # B.convert(amount_b, A) = amount_c != amount_a

        counterpart_vals = {
            'name': self.payment_ref,
            'account_id': counterpart_account_id,
            'amount_residual': liquidity_line_vals['debit'] - liquidity_line_vals['credit'],
        }

        if self.foreign_currency_id and self.foreign_currency_id != self.company_currency_id:
            # Ensure the counterpart will have exactly the same amount in foreign currency as the amount set in the
            # statement line to avoid some rounding issues when making a currency conversion.

            counterpart_vals.update({
                'currency_id': self.foreign_currency_id.id,
                'amount_residual_currency': self.amount_currency,
            })
        elif liquidity_line_vals['currency_id']:
            # Ensure the counterpart will have a balance exactly equals to the amount in journal currency.
            # This avoid some rounding issues when the currency rate between two currencies is not symmetrical.
            # E.g:
            # A.convert(amount_a, B) = amount_b
            # B.convert(amount_b, A) = amount_c != amount_a

            counterpart_vals.update({
                'currency_id': liquidity_line_vals['currency_id'],
                'amount_residual_currency': liquidity_line_vals['amount_currency'],
            })

        counterpart_line_vals = self._prepare_counterpart_move_line_vals(counterpart_vals)
        return [liquidity_line_vals, counterpart_line_vals]

    # -------------------------------------------------------------------------
    # COMPUTE METHODS
    # -------------------------------------------------------------------------

    @api.depends('journal_id', 'currency_id', 'amount', 'foreign_currency_id', 'amount_currency',
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

    @api.depends('journal_id')
    def _compute_currency_id(self):
        for pay in self:
            pay.currency_id = pay.journal_id.currency_id or pay.journal_id.company_id.currency_id

    @api.depends('move_id.line_ids.matched_debit_ids', 'move_id.line_ids.matched_credit_ids')
    def _compute_stat_buttons_from_reconciliation(self):
        for to_flush in ('account.move', 'account.move.line', 'account.partial.reconcile'):
            self.env[to_flush].flush(self.env[to_flush]._fields)

        res = defaultdict(set)
        stored_ids = self._origin.ids
        if stored_ids:
            self._cr.execute('''
                SELECT
                    line.statement_line_id,
                    ARRAY_AGG(credit_line.move_id) AS move_ids
                FROM account_move_line line
                JOIN account_partial_reconcile part ON part.debit_move_id = line.id
                JOIN account_move_line credit_line ON credit_line.id = part.credit_move_id
                WHERE line.statement_line_id IN %s
                GROUP BY 1
    
                UNION ALL
    
                SELECT
                    line.statement_line_id,
                    ARRAY_AGG(debit_line.move_id) AS move_ids
                FROM account_move_line line
                JOIN account_partial_reconcile part ON part.credit_move_id = line.id
                JOIN account_move_line debit_line ON debit_line.id = part.debit_move_id
                WHERE line.statement_line_id IN %s
                GROUP BY 1
            ''', [tuple(self.ids), tuple(self.ids)])
            for st_line_id, move_ids in self._cr.fetchall():
                for move_id in move_ids:
                    res[st_line_id].add(move_id)

        for st_line in self:
            rec_moves = self.env['account.move'].browse(list(res[st_line.id]))
            st_line.reconciled_move_ids = rec_moves
            st_line.reconciled_move_ids_count = len(rec_moves)

    @api.depends('statement_id', 'date')
    def _compute_running_balance_end(self):
        st_line_ids = []
        journal_ids = set()
        for st_line in self:
            if st_line._origin:
                st_line_ids.append(st_line._origin.id)
                journal_ids.add(st_line.journal_id.id)
            else:
                st_line.running_balance_end = 0.0

        if not st_line_ids:
            return

        record_by_id = {st_line._origin.id: st_line for st_line in self}
        domain = [('journal_id', 'in', tuple(journal_ids))]
        query = self._where_calc(domain)
        tables, where_clause, where_params = query.get_sql()
        order_by = ', '.join(self._generate_order_by_inner(
            self._table,
            self._order,
            query,
            reverse_direction=True,
        ))

        self.statement_id.flush(['last_date', 'date'])
        self.flush(['amount', 'date', 'journal_id', 'statement_id'])
        self._cr.execute(f'''
            SELECT
                *
            FROM (
                SELECT
                    account_bank_statement_line.id,
                    SUM(account_bank_statement_line.amount) OVER (
                        PARTITION BY account_bank_statement_line__move_id.journal_id
                        ORDER BY {order_by}
                        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
                    ) AS running_balance_start
                FROM {tables}
                LEFT JOIN account_bank_statement account_bank_statement_line__statement_id
                    ON account_bank_statement_line__statement_id.id = account_bank_statement_line.statement_id
                WHERE {where_clause}
            ) AS sub
            WHERE sub.id IN %s
        ''', where_params + [tuple(st_line_ids)])

        for st_line_id, balance in self._cr.fetchall():
            record_by_id[st_line_id].running_balance_end = balance

    # -------------------------------------------------------------------------
    # CONSTRAINT METHODS
    # -------------------------------------------------------------------------

    @api.constrains('amount', 'amount_currency', 'currency_id', 'foreign_currency_id', 'journal_id')
    def _check_amounts_currencies(self):
        ''' Ensure the consistency the specified amounts and the currencies. '''

        for st_line in self:
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

            # Force the computation of 'journal_id' since this field is set on account.move but must have the
            # bank/cash type.
            if 'journal_id' not in vals:
                vals['journal_id'] = self._get_default_journal().id

            # Hack to force different account instead of the suspense account.
            counterpart_account_ids.append(vals.pop('counterpart_account_id', None))

        st_lines = super().create(vals_list)

        for i, st_line in enumerate(st_lines):
            counterpart_account_id = counterpart_account_ids[i]

            to_write = {'statement_line_id': st_line.id}
            if 'line_ids' not in vals_list[i]:
                to_write['line_ids'] = [(0, 0, line_vals) for line_vals in st_line._prepare_move_line_default_vals(counterpart_account_id=counterpart_account_id)]

            st_line.move_id.write(to_write)

        return st_lines

    def write(self, vals):
        # OVERRIDE
        res = super().write(vals)
        self._synchronize_to_moves(set(vals.keys()))
        return res

    def unlink(self):
        # OVERRIDE to unlink the inherited account.move (move_id field) as well.
        moves = self.with_context(force_delete=True).mapped('move_id')
        res = super().unlink()
        moves.unlink()
        return res

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

            st_line.move_id.write({
                'partner_id': st_line.partner_id.id,
                'currency_id': (st_line.foreign_currency_id or journal_currency or company_currency).id,
                'line_ids': line_ids_commands,
            })

    # -------------------------------------------------------------------------
    # RECONCILIATION METHODS
    # -------------------------------------------------------------------------

    def _prepare_reconciliation(self, lines_vals_list):
        ''' Helper for the "reconcile" method used to get a full preview of the reconciliation result. This method is
        quite useful to deal with reconcile models or the reconciliation widget because it ensures the values seen by
        the user are exactly the values you get after reconciling.

        :param lines_vals_list:             See the 'reconcile' method.
        :return: The diff to be applied on the statement line as a tuple
        (
            lines_to_create:    The values to create the account.move.line on the statement line.
            payments_to_create: The values to create the account.payments.
            open_balance_vals:  A dictionary to create the open-balance line or None if the reconciliation is full.
            existing_lines:     The counterpart lines to which the reconciliation will be done.
        )
        '''

        self.ensure_one()
        journal = self.journal_id
        company_currency = journal.company_id.currency_id
        foreign_currency = self.foreign_currency_id or journal.currency_id or company_currency

        liquidity_lines, suspense_lines, other_lines = self._seek_for_lines()

        # Ensure the statement line has not yet been already reconciled.
        # If the move has 'to_check' enabled, it means the statement line has created some lines that
        # need to be checked later and replaced by the real ones.
        if not self.move_id.to_check and other_lines:
            raise UserError(_("The statement line has already been reconciled."))

        # A list of dictionary containing:
        # - line_vals:          The values to create the account.move.line on the statement line.
        # - payment_vals:       The optional values to create a bridge account.payment
        # - counterpart_line:   The optional counterpart line to reconcile with 'line'.
        reconciliation_overview = []

        total_balance = liquidity_lines.balance
        total_amount_currency = liquidity_lines.amount_currency

        # Step 1: Split 'lines_vals_list' into two batches:
        # - The existing account.move.lines that need to be reconciled with the statement line.
        #       => Will be managed at step 2.
        # - The account.move.lines to be created from scratch.
        #       => Will be managed directly.

        to_browse_ids = []
        to_process_vals = []
        for vals in lines_vals_list:
            # Don't modify the params directly.
            vals = dict(vals)

            if 'id' in vals:
                # Existing account.move.line.
                to_browse_ids.append(vals.pop('id'))
                to_process_vals.append(vals)
            else:
                # Newly created account.move.line from scratch.
                line_vals = self._prepare_counterpart_move_line_vals(vals)
                total_balance += line_vals['debit'] - line_vals['credit']
                total_amount_currency += line_vals['amount_currency']

                reconciliation_overview.append({
                    'line_vals': line_vals,
                })

        # Step 2: Browse counterpart lines all in one and process them.

        existing_lines = self.env['account.move.line'].browse(to_browse_ids)
        for line, counterpart_vals in zip(existing_lines, to_process_vals):
            line_vals = self._prepare_counterpart_move_line_vals(counterpart_vals, move_line=line)
            balance = line_vals['debit'] - line_vals['credit']
            amount_currency = line_vals['amount_currency']

            reconciliation_overview.append({
                'line_vals': line_vals,
                'counterpart_line': line,
            })

            total_balance += balance
            total_amount_currency += amount_currency

        # Step 3: Fix rounding issue due to currency conversions.
        # Add the remaining balance on the first encountered line starting with the custom ones.

        if foreign_currency.is_zero(total_amount_currency) and not company_currency.is_zero(total_balance):
            vals = reconciliation_overview[0]['line_vals']
            new_balance = vals['debit'] - vals['credit'] - total_balance
            vals.update({
                'debit': new_balance if new_balance > 0.0 else 0.0,
                'credit': -new_balance if new_balance < 0.0 else 0.0,
            })
            total_balance = 0.0

        # Step 4: If the journal entry is not yet balanced, create an open balance.

        if self.company_currency_id.round(total_balance):
            counterpart_vals = {
                'name': '%s: %s' % (self.payment_ref, _('Open Balance')),
                'balance': -total_balance,
                'currency_id': self.company_currency_id.id,
            }

            partner = self.partner_id or existing_lines.mapped('partner_id')[:1]
            if partner:
                if self.amount > 0:
                    open_balance_account = partner.with_company(self.company_id).property_account_receivable_id
                else:
                    open_balance_account = partner.with_company(self.company_id).property_account_payable_id

                counterpart_vals['account_id'] = open_balance_account.id
                counterpart_vals['partner_id'] = partner.id
            else:
                if self.amount > 0:
                    open_balance_account = self.company_id.partner_id.with_company(self.company_id).property_account_receivable_id
                else:
                    open_balance_account = self.company_id.partner_id.with_company(self.company_id).property_account_payable_id
                counterpart_vals['account_id'] = open_balance_account.id

            open_balance_vals = self._prepare_counterpart_move_line_vals(counterpart_vals)
        else:
            open_balance_vals = None

        return reconciliation_overview, open_balance_vals

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
                                considered as the amount in foreign currency. If not specified, the full balance is taken.
                                This value must be provided if 'id' is not.
            **kwargs:           Custom values to be set on the newly created account.move.line.
        :param to_check:        Mark the current statement line as "to_check" (see field for more details).
        '''
        self.ensure_one()
        liquidity_lines, suspense_lines, other_lines = self._seek_for_lines()

        reconciliation_overview, open_balance_vals = self._prepare_reconciliation(lines_vals_list)

        # ==== Manage res.partner.bank ====

        if self.account_number and self.partner_id and not self.partner_bank_id:
            self.partner_bank_id = self._find_or_create_bank_account()

        # ==== Check open balance ====

        if open_balance_vals:
            if not open_balance_vals.get('partner_id'):
                raise UserError(_("Unable to create an open balance for a statement line without a partner set."))
            if not open_balance_vals.get('account_id'):
                raise UserError(_("Unable to create an open balance for a statement line because the receivable "
                                  "/ payable accounts are missing on the partner."))

        # ==== Create & reconcile lines on the bank statement line ====

        to_create_commands = [(0, 0, open_balance_vals)] if open_balance_vals else []
        to_delete_commands = [(2, line.id) for line in suspense_lines + other_lines]

        # Cleanup previous lines.
        self.move_id.with_context(check_move_validity=False, skip_account_move_synchronization=True, force_delete=True).write({
            'line_ids': to_delete_commands + to_create_commands,
            'to_check': to_check,
        })

        line_vals_list = [reconciliation_vals['line_vals'] for reconciliation_vals in reconciliation_overview]
        new_lines = self.env['account.move.line'].create(line_vals_list)
        new_lines = new_lines.with_context(skip_account_move_synchronization=True)
        for reconciliation_vals, line in zip(reconciliation_overview, new_lines):
            if reconciliation_vals.get('payment'):
                accounts = (self.journal_id.payment_debit_account_id, self.journal_id.payment_credit_account_id)
                counterpart_line = reconciliation_vals['payment'].line_ids.filtered(lambda line: line.account_id in accounts)
            elif reconciliation_vals.get('counterpart_line'):
                counterpart_line = reconciliation_vals['counterpart_line']
            else:
                continue

            (line + counterpart_line).reconcile()

        # Assign partner if needed (for example, when reconciling a statement
        # line with no partner, with an invoice; assign the partner of this invoice)
        if not self.partner_id:
            rec_overview_partners = set(overview['counterpart_line'].partner_id.id
                                        for overview in reconciliation_overview
                                        if overview.get('counterpart_line') and overview['counterpart_line'].partner_id)
            if len(rec_overview_partners) == 1:
                self.line_ids.write({'partner_id': rec_overview_partners.pop()})

        # Refresh analytic lines.
        self.move_id.line_ids.analytic_line_ids.unlink()
        self.move_id.line_ids.create_analytic_lines()

    # -------------------------------------------------------------------------
    # ACTIONS
    # -------------------------------------------------------------------------

    def button_post(self):
        ''' draft -> posted '''
        self.move_id.action_post()

    def button_cancel(self):
        ''' draft -> cancel '''
        self.move_id.button_cancel()

    def button_draft(self):
        ''' (posted || cancel) -> draft '''
        self.move_id.button_draft()

    def button_open_reconciled_moves(self):
        ''' Redirect the user to the bill(s) paid by this payment.
        :return:    An action on account.move.
        '''
        self.ensure_one()

        action = {
            'name': _("Reconciled Journal Entries"),
            'type': 'ir.actions.act_window',
            'res_model': 'account.move',
            'context': {'create': False},
        }
        if self.reconciled_move_ids_count == 1:
            action.update({
                'view_mode': 'form',
                'res_id': self.reconciled_move_ids.id,
            })
        else:
            action.update({
                'view_mode': 'list,form',
                'domain': [('id', 'in', self.reconciled_move_ids.ids)],
            })
        return action

    def button_create_statement(self):
        if len(self.journal_id) != 1:
            raise UserError(_("All transactions must belong to the same journal."))
        if self.statement_id:
            raise UserError(_("Some of your transactions are already linked to a bank statement."))

        return {
            'name': _("Bank Statement"),
            'view_mode': 'form',
            'res_model': 'account.bank.statement',
            'view_id': self.env.ref('account.view_bank_statement_form_popup').id,
            'type': 'ir.actions.act_window',
            'context': {
                'default_line_ids': [Command.set(self.ids)],
            },
            'target': 'new',
        }

    def button_set_journal_starting_balance(self):
        journal = self.journal_id
        if len(journal) != 1:
            raise UserError(_("All transactions must belong to the same journal."))

        return {
            'name': journal.display_name,
            'view_mode': 'form',
            'res_model': 'account.journal',
            'res_id': journal.id,
            'view_id': self.env.ref('account.view_account_journal_form_set_starting_balance').id,
            'type': 'ir.actions.act_window',
            'target': 'new',
        }

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
        self.line_ids.remove_move_reconcile()
        self.payment_ids.unlink()

        for st_line in self:
            st_line.with_context(force_delete=True).write({
                'to_check': False,
                'line_ids': [(5, 0)] + [(0, 0, line_vals) for line_vals in st_line._prepare_move_line_default_vals()],
            })
