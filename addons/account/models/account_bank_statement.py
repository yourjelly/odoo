# -*- coding: utf-8 -*-

from odoo import api, fields, models, _
from odoo.tools import float_is_zero, html2plaintext
from odoo.exceptions import UserError, ValidationError
from odoo.osv.expression import get_unaccent_wrapper
from odoo.addons.base.models.res_bank import sanitize_account_number


class AccountBankStatement(models.Model):
    _name = "account.bank.statement"
    _description = "Bank Statement"
    _order = "last_date desc, name desc, id desc"
    _inherit = ['mail.thread', 'sequence.mixin']

    @api.model
    def _default_start_statement_id(self):
        if self._context.get('active_model') != 'account.bank.statement.line' or not self._context.get('active_id'):
            return None

        return self.env['account.bank.statement.line'].browse(self._context['active_id'])

    @api.model
    def _default_end_statement_id(self):
        if self._context.get('active_model') != 'account.bank.statement.line' or not self._context.get('active_id'):
            return None

        source_st_line = self.env['account.bank.statement.line'].browse(self._context['active_id'])

        # Find the previous bank statement in the chain.
        source_st_line.flush_model(fnames=['amount', 'date', 'sequence', 'journal_id'])
        self.flush_model(fnames=['start_statement_line_id', 'end_statement_line_id'])
        self._cr.execute(
            '''
                SELECT
                    st.start_statement_line_id,
                    st.start_statement_line_date,
                    st.start_statement_line_sequence
                FROM account_bank_statement st
                WHERE st.journal_id = %s
                    AND
                    (
                        st.start_statement_line_date < %s
                        OR (
                            st.start_statement_line_date = %s
                            AND (
                                st.start_statement_line_sequence > %s
                                OR (
                                    st.start_statement_line_sequence = %s
                                    AND st.start_statement_line_id < %s
                                )
                            )
                        )
                    )
                ORDER BY st.start_statement_line_date
                LIMIT 1
            ''',
            [
                source_st_line.journal_id.id,
                source_st_line.date,
                source_st_line.date,
                source_st_line.sequence,
                source_st_line.sequence,
                source_st_line.id,
            ],
        )
        row = self._cr.fetchone()
        if row:
            last_st_line_id, last_st_line_date, last_st_line_sequence = row
            st_query_clause = '''
                AND
                (
                    move.date > %s
                    OR (
                        move.date = %s
                        AND (
                            st_line.sequence < %s
                            OR (
                                st_line.sequence = %s
                                AND st_line.id > %s
                            )
                        )
                    )
                )
            '''
            st_query_params = [
                last_st_line_date,
                last_st_line_date,
                last_st_line_sequence,
                last_st_line_sequence,
                last_st_line_id,
            ]
        else:
            st_query_clause = ''
            st_query_params = []

        self._cr.execute(
            f'''
                SELECT st_line.id
                FROM account_bank_statement_line st_line
                JOIN account_move move ON move.id = st_line.move_id
                WHERE move.journal_id = %s
                    AND
                    (
                        move.date < %s
                        OR (
                            move.date = %s
                            AND (
                                st_line.sequence > %s
                                OR (
                                    st_line.sequence = %s
                                    AND st_line.id < %s
                                )
                            )
                        )
                    )
                    {st_query_clause}
                ORDER BY move.date, st_line.sequence DESC, st_line.id
                LIMIT 1
            ''',
            [
                source_st_line.journal_id.id,
                source_st_line.date,
                source_st_line.date,
                source_st_line.sequence,
                source_st_line.sequence,
                source_st_line.id,
            ] + st_query_params,
        )
        row = self._cr.fetchone()
        if row:
            return self.env['account.bank.statement.line'].browse(row[0])
        else:
            return source_st_line

    name = fields.Char(
        string="Reference",
        copy=False,
    )
    currency_id = fields.Many2one(
        comodel_name='res.currency',
        compute='_compute_currency_id',
        store=True,
        required=True,
        precompute=True,
    )
    date = fields.Date(
        compute='_compute_date',
        required=True,
        index=True,
        precompute=True,
        store=True,
        readonly=False,
    )
    journal_id = fields.Many2one(
        comodel_name='account.journal',
        compute='_compute_journal_id',
        store=True,
        required=True,
        precompute=True,
    )
    last_date = fields.Date(
        string="Last Date",
        related='end_statement_line_id.date',
        store=True,
    )
    balance_start = fields.Monetary(
        string="Starting Balance",
        currency_field='currency_id',
        compute='_compute_balance',
        store=True,
        readonly=False,
    )
    balance_end = fields.Monetary(
        string="Ending Balance",
        currency_field='currency_id',
        compute='_compute_balance',
        store=True,
        readonly=False,
    )
    start_statement_line_id = fields.Many2one(
        comodel_name='account.bank.statement.line',
        required=True,
        default=_default_start_statement_id,
    )
    start_statement_line_date = fields.Date(
        string="Start Date",
        related='start_statement_line_id.move_id.date',
        store=True,
    )
    start_statement_line_sequence = fields.Integer(
        string="Start Sequence",
        related='start_statement_line_id.sequence',
        store=True,
    )
    end_statement_line_id = fields.Many2one(
        comodel_name='account.bank.statement.line',
        required=True,
        default=_default_end_statement_id,
    )
    end_statement_line_date = fields.Date(
        string="End Date",
        related='end_statement_line_id.move_id.date',
        store=True,
    )
    end_statement_line_sequence = fields.Integer(
        string="End Sequence",
        related='end_statement_line_id.sequence',
        store=True,
    )
    attachment_id = fields.Many2one(
        comodel_name='ir.attachment',
    )

    is_difference_zero = fields.Boolean(
        compute='_compute_is_difference_zero',
    )

    # -------------------------------------------------------------------------
    # CONSTRAINT METHODS
    # -------------------------------------------------------------------------

    def _constrains_date_sequence(self):
        # Multiple import methods set the name to things that are not sequences:
        # i.e. Statement from {date1} to {date2}
        # It makes this constraint not applicable, and it is less needed on bank statements as it
        # is only an indication and not some thing legal.
        return

    def _get_last_sequence_domain(self, relaxed=False):
        self.ensure_one()
        where_string = "WHERE journal_id = %(journal_id)s AND name != '/'"
        param = {'journal_id': self.journal_id.id}

        if not relaxed:
            domain = [('journal_id', '=', self.journal_id.id), ('id', '!=', self.id or self._origin.id), ('name', '!=', False)]
            previous_name = self.search(domain + [('date', '<', self.date)], order='date desc', limit=1).name
            if not previous_name:
                previous_name = self.search(domain, order='date desc', limit=1).name
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
        return "%s %s %04d/%02d/00000" % (self.journal_id.code, _('Statement'), self.date.year, self.date.month)

    # -------------------------------------------------------------------------
    # COMPUTE METHODS
    # -------------------------------------------------------------------------

    @api.depends('start_statement_line_id', 'end_statement_line_id', 'balance_start', 'balance_end')
    def _compute_is_difference_zero(self):
        for statement in self:
            currency = statement.currency_id
            statement.is_difference_zero = True
            if currency \
                    and statement.start_statement_line_id \
                    and currency.compare_amounts(statement.start_statement_line_id.running_balance_start, statement.balance_start) != 0:
                statement.is_difference_zero = False
            if currency \
                    and statement.end_statement_line_id \
                    and currency.compare_amounts(statement.end_statement_line_id.running_balance_end, statement.balance_end) != 0:
                statement.is_difference_zero = False

    @api.depends('end_statement_line_id')
    def _compute_date(self):
        for statement in self:
            statement.date = statement.end_statement_line_id.date

    @api.depends('start_statement_line_id')
    def _compute_journal_id(self):
        for statement in self:
            statement.journal_id = statement.start_statement_line_id.journal_id

    @api.depends('journal_id')
    def _compute_currency_id(self):
        for statement in self:
            statement.currency_id = statement.journal_id.currency_id or statement.journal_id.company_id.currency_id

    @api.depends('start_statement_line_id', 'end_statement_line_id')
    def _compute_balance(self):
        for statement in self:
            statement.balance_end = statement.start_statement_line_id.running_balance_end
            statement.balance_start = statement.end_statement_line_id.running_balance_start


class AccountBankStatementLine(models.Model):
    _name = "account.bank.statement.line"
    _inherits = {'account.move': 'move_id'}
    _description = "Bank Statement Line"
    _order = "date desc, sequence, id desc"
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
        auto_join=True,
        string='Journal Entry', required=True, readonly=True, ondelete='cascade',
        check_company=True)

    sequence = fields.Integer(
        help="Gives the sequence order when displaying a list of bank statement lines.",
        default=10,
    )
    account_number = fields.Char(string='Bank Account Number', help="Technical field used to store the bank account number before its creation, upon the line's processing")
    partner_name = fields.Char(
        help="This field is used to record the third party name when importing bank statement in electronic format, "
             "when the partner doesn't exist yet in the database (or cannot be found).")
    transaction_type = fields.Char(string='Transaction Type')
    payment_ref = fields.Char(string='Label', required=True)
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

    # == Running balances ==
    statement_id = fields.Many2one(
        comodel_name='account.bank.statement',
        string="Statement",
        store=False,
        compute='_compute_statement_id',
        inverse='_inverse_statement_id',
    )
    running_balance_start = fields.Monetary(
        string="Running Balance Before",
        store=False,
        currency_field='currency_id',
        compute='_compute_running_balance',
        help="Technical field for keeping running balance before this record",
    )
    running_balance_end = fields.Monetary(
        string="Running Ending Balance",
        store=False,
        currency_field='currency_id',
        compute='_compute_running_balance',
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

    # -------------------------------------------------------------------------
    # COMPUTE METHODS
    # -------------------------------------------------------------------------

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

    @api.depends('journal_id')
    def _compute_currency_id(self):
        for pay in self:
            pay.currency_id = pay.journal_id.currency_id or pay.journal_id.company_id.currency_id

    @api.depends('date', 'sequence', 'journal_id')
    def _compute_statement_id(self):
        stored_lines = self.filtered('id')

        st_id_map = {}
        if stored_lines:
            # Statement lines are stored inside the database.

            self.flush_recordset(fnames=['amount', 'date', 'sequence', 'journal_id'])
            self._cr.execute('''
                SELECT
                    st_line.id,
                    st.id
                FROM account_bank_statement_line st_line
                JOIN account_move move ON move.id = st_line.move_id
                JOIN account_bank_statement st ON
                    st.journal_id = move.journal_id
                    AND
                    (
                        move.date < st.start_statement_line_date
                        OR (
                            move.date = st.start_statement_line_date
                            AND (
                                st_line.sequence > st.start_statement_line_sequence
                                OR (
                                    st_line.sequence = st.start_statement_line_sequence
                                    AND st_line.id <= st.start_statement_line_id
                                )
                            )
                        )
                    )
                    AND
                    (
                        move.date > st.end_statement_line_date
                        OR (
                            move.date = st.end_statement_line_date
                            AND (
                                st_line.sequence < st.end_statement_line_sequence
                                OR (
                                    st_line.sequence = st.end_statement_line_sequence
                                    AND st_line.id >= st.end_statement_line_id
                                )
                            )
                        )
                    )
                WHERE st_line.id IN %s
            ''', [tuple(stored_lines.ids)])

            st_id_map.update({st_line_id: st_id for st_line_id, st_id in self._cr.fetchall()})

        for st_line in self:
            st_line.statement_id = st_id_map.get(st_line.id)

    def _inverse_statement_id(self):
        # TODO
        pass

    @api.depends('date', 'sequence', 'journal_id', 'amount')
    def _compute_running_balance(self):
        stored_lines = self.filtered(lambda x: x._origin)

        balance_map = {}

        if stored_lines:
            journal_ids = stored_lines.journal_id._origin.ids
            base_domain = [('journal_id', 'in', tuple(journal_ids)), ('state', '!=', 'cancel')]

            # Fetch the starting balance to consider to avoid computing the running balance on the whole database.
            self.flush_recordset(fnames=['amount', 'date', 'sequence', 'journal_id'])
            min_date = min(self.mapped('date'))
            query = self._where_calc(base_domain + [('date', '<', min_date)])
            tables, where_clause, where_params = query.get_sql()
            self._cr.execute(
                f'''
                    SELECT
                        move.journal_id,
                        SUM(account_bank_statement_line.amount)
                    FROM {tables}
                    JOIN account_move move ON move.id = account_bank_statement_line.move_id
                    WHERE {where_clause}
                    GROUP BY move.journal_id
                ''',
                where_params,
            )
            starting_balance_per_journal = {r[0]: r[1] for r in self._cr.fetchall()}

            # Compute the running balances.
            max_date = max(self.mapped('date'))
            query = self._where_calc(base_domain + [('date', '>=', min_date), ('date', '<=', max_date)])
            tables, where_clause, where_params = query.get_sql()
            order_by = ', '.join(self._generate_order_by_inner(
                self._table,
                self._order,
                query,
                reverse_direction=True,
            ))

            self._cr.execute(f'''
                SELECT
                    *
                FROM (
                    SELECT
                        account_bank_statement_line.id,
                        move.journal_id,
                        account_bank_statement_line.amount,
                        SUM(account_bank_statement_line.amount) OVER (
                            PARTITION BY account_bank_statement_line__move_id.journal_id
                            ORDER BY {order_by}
                            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
                        ) AS running_balance_start
                    FROM {tables}
                    JOIN account_move move ON move.id = account_bank_statement_line.move_id
                    WHERE {where_clause}
                ) AS sub
                WHERE sub.id IN %s
            ''', where_params + [tuple(stored_lines.ids)])

            for st_line_id, journal_id, amount, running_balance_start in self._cr.fetchall():
                starting_journal_balance = starting_balance_per_journal.get(journal_id, 0.0)
                balance_map[st_line_id] = (
                    starting_journal_balance + running_balance_start,
                    starting_journal_balance + running_balance_start - amount,
                )

        for st_line in self:
            end, start = balance_map.get(st_line.id, (0.0, 0.0))
            st_line.running_balance_end = end
            st_line.running_balance_start = start

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

            to_write = {'statement_line_id': st_line.id, 'narration': st_line.narration}
            if 'line_ids' not in vals_list[i]:
                to_write['line_ids'] = [(0, 0, line_vals) for line_vals in st_line._prepare_move_line_default_vals(counterpart_account_id=counterpart_account_id)]

            st_line.move_id.write(to_write)

            # Otherwise field narration will be recomputed silently (at next flush) when writing on partner_id
            self.env.remove_to_compute(st_line.move_id._fields['narration'], st_line.move_id)
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
                return html2plaintext(self[field_name])
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
        unaccent = get_unaccent_wrapper(self._cr)
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
                [self.company_id.id] + params,
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

    def button_undo_reconciliation(self):
        ''' Undo the reconciliation mades on the statement line and reset their journal items
        to their original states.
        '''
        self.line_ids.remove_move_reconcile()

        for st_line in self:
            st_line.with_context(force_delete=True).write({
                'to_check': False,
                'line_ids': [(5, 0)] + [(0, 0, line_vals) for line_vals in st_line._prepare_move_line_default_vals()],
            })

    def button_post(self):
        ''' draft -> posted '''
        self.move_id.action_post()

    def button_cancel(self):
        ''' draft -> cancel '''
        self.move_id.button_cancel()

    def button_draft(self):
        ''' (posted || cancel) -> draft '''
        self.move_id.button_draft()
