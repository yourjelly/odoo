# -*- coding: utf-8 -*-
from odoo import api, fields, models, _, Command
from odoo.exceptions import UserError
from odoo.tools.misc import formatLang

class AccountBankStatement(models.Model):
    _name = "account.bank.statement"
    _description = "Bank Statement"
    _order = "first_line_index desc"
    _check_company_auto = True

    name = fields.Char(
        string='Reference',
        copy=False,
    )

    # Used to hold the reference of the external mean that created this statement (name of imported file,
    # reference of online synchronization...)
    reference = fields.Char(
        string='External Reference',
        copy=False,
    )

    date = fields.Date(
        compute='_compute_date_index', store=True,
    )

    # The internal index of the first line of a statement, it is used for sorting the statements
    # The date field cannot be used as there might be more than one statement in one day.
    # keeping this order is important because the validity of the statements are based on their order
    first_line_index = fields.Char(
        comodel_name='account.bank.statement.line',
        compute='_compute_date_index', store=True, index=True,
    )

    balance_start = fields.Monetary(
        string='Starting Balance',
        compute='_compute_balance_start', store=True, readonly=False,
    )

    # Balance end is calculated based on the statement line amounts and real starting balance.
    balance_end = fields.Monetary(
        string='Computed Balance',
        compute='_compute_balance_end', store=True,
    )

    balance_end_real = fields.Monetary(
        string='Ending Balance',
        compute='_compute_balance_end_real', store=True, readonly=False,
    )

    company_id = fields.Many2one(
        comodel_name='res.company',
        related='journal_id.company_id', store=True,
    )

    currency_id = fields.Many2one(
        comodel_name='res.currency',
        compute='_compute_currency_id',
    )

    journal_id = fields.Many2one(
        comodel_name='account.journal',
        compute='_compute_journal_id', store=True,
        check_company=True,
    )

    line_ids = fields.One2many(
        comodel_name='account.bank.statement.line',
        inverse_name='statement_id',
        string='Statement lines',
        required=True,
    )

    # A statement assumed to be complete when the sum of encoded lines is equal to the difference between initial and
    # ending balances. In other words, a statement is complete when there are enough lines to fill the value between
    # initial and final balances. When the user reaches this point, the statement is not autofilled on the new lines?
    is_complete = fields.Boolean(
        compute='_compute_is_complete', store=True,
    )

    # A statement is considered valid when the starting balance matches the ending balance of the previous statement.
    # The lines without statements are neglected because, either the user is using statements regularly, so they can
    # assume every line without statement is problematic, or they don't use them regularly, in that case statements are
    # working as checkpoints only and their validity is not important.
    # The first statement of a journal is always considered valid. The validity of the statement is based on other
    # statements, so one can say this is external integrity check were as is_complete is the internal integrity.
    is_valid = fields.Boolean(
        compute='_compute_is_valid',
        search='_search_is_valid',
    )

    problem_description = fields.Text(
        compute='_compute_problem_description',
    )

    attachment_ids = fields.Many2many(
        comodel_name='ir.attachment',
        string="Attachments",
    )

    # -------------------------------------------------------------------------
    # COMPUTE METHODS
    # -------------------------------------------------------------------------
    @api.depends('line_ids.internal_index', 'line_ids.state')
    def _compute_date_index(self):
        for stmt in self:
            sorted_lines = stmt.line_ids.sorted('internal_index')
            stmt.first_line_index = sorted_lines[:1].internal_index
            stmt.date = sorted_lines.filtered(lambda l: l.state == 'posted')[-1:].date

    @api.depends('create_date')
    def _compute_balance_start(self):
        for stmt in self.sorted(lambda x: x.first_line_index or '0'):
            lines_in_between_domain = [
                ('internal_index', '<', stmt.first_line_index),
                ('journal_id', '=', stmt.journal_id.id),
                ('state', '=', 'posted'),
            ]

            previous_line_with_statement = self.env['account.bank.statement.line'].search([
                ('internal_index', '<', stmt.first_line_index),
                ('journal_id', '=', stmt.journal_id.id),
                ('state', '=', 'posted'),
                ('statement_id', '!=', False),
            ], limit=1)
            balance_start = previous_line_with_statement.statement_id.balance_end_real
            if previous_line_with_statement:
                lines_in_between_domain.append(('internal_index', '>', previous_line_with_statement.internal_index))

            lines_in_between = self.env['account.bank.statement.line'].search(lines_in_between_domain)
            balance_start += sum(lines_in_between.mapped('amount'))

            stmt.balance_start = balance_start

    @api.depends('balance_start', 'line_ids.amount')
    def _compute_balance_end(self):
        for stmt in self:
            lines = stmt.line_ids.filtered(lambda x: x.state == 'posted')
            stmt.balance_end = stmt.balance_start + sum(lines.mapped('amount'))

    @api.depends('balance_start')
    def _compute_balance_end_real(self):
        for stmt in self:
            stmt.balance_end_real = stmt.balance_end

    @api.depends('journal_id')
    def _compute_currency_id(self):
        for statement in self:
            statement.currency_id = statement.journal_id.currency_id or statement.company_id.currency_id

    @api.depends('line_ids.journal_id')
    def _compute_journal_id(self):
        for statement in self:
            statement.journal_id = statement.line_ids.journal_id

    @api.depends('balance_end_real', 'balance_end')
    def _compute_is_complete(self):
        for stmt in self:
            stmt.is_complete = stmt.line_ids.filtered(lambda l: l.state == 'posted') and stmt.currency_id.compare_amounts(
                stmt.balance_end, stmt.balance_end_real) == 0

    @api.depends('balance_end_real', 'balance_end')
    def _compute_is_valid(self):
        # we extract the invalid statements, the statements with no lines and the first statement are not in the query
        # because they don't have a previous statement, so they are excluded from the join, and we consider them valid.
        # if we have extracted the valid ones, we would have to mark above-mentioned statements valid manually
        # The computation for a single record differs from a list of records
        invalids = self.filtered(lambda s: s.id in self._get_invalid_statement_ids())
        invalids.is_valid = False
        (self - invalids).is_valid = True

    @api.depends('balance_end_real', 'balance_end')
    def _compute_problem_description(self):
        for stmt in self:
            description = ""
            if not stmt.is_valid:
                description = _("The starting balance doesn't match the ending balance of the previous statement, or an earlier statement is missing.")
            elif not stmt.is_complete:
                description = _("The starting balance and transaction values (%s) don't add up to the ending balance.", formatLang(self.env, stmt.balance_end, currency_obj=stmt.currency_id))
            stmt.problem_description = description

    def _search_is_valid(self, operator, value):
        if operator not in ('=', '!=', '<>'):
            raise UserError(_('Operation not supported'))
        invalid_ids = self._get_invalid_statement_ids(all_statements=True)
        if operator in ('!=', '<>') and value or operator == '=' and not value:
            return [('id', 'in', invalid_ids)]
        return [('id', 'not in', invalid_ids)]

    # -------------------------------------------------------------------------
    # BUSINESS METHODS
    # -------------------------------------------------------------------------
    def _get_invalid_statement_ids(self, all_statements=None):
        """ Returns the statements that are invalid for _compute and _search methods."""
        self.env['account.bank.statement.line'].flush_model(['statement_id', 'internal_index'])
        self.env['account.bank.statement'].flush_model(['balance_start', 'balance_end_real', 'first_line_index'])

        self.env.cr.execute(f"""
            SELECT id
              FROM account_bank_statement st,
                   LATERAL (
                       SELECT balance_end_real
                         FROM account_bank_statement st_lookup
                        WHERE st_lookup.first_line_index < st.first_line_index
                          AND st_lookup.journal_id = st.journal_id
                     ORDER BY st_lookup.first_line_index desc
                        LIMIT 1
                   ) prev
             WHERE prev.balance_end_real != st.balance_start
               {"" if all_statements else "AND st.id IN %(ids)s"}
        """, {
            'ids': tuple(self.ids)
        })
        res = self.env.cr.fetchall()
        return [r[0] for r in res]
    
    # -------------------------------------------------------------------------
    # LOW-LEVEL METHODS
    # -------------------------------------------------------------------------

    @api.model
    def default_get(self, fields_list):
        # EXTENDS base
        defaults = super().default_get(fields_list)

        if 'line_ids' not in fields_list:
            return defaults
    
        active_ids = self._context.get('active_ids')
        context_split_line_id = self._context.get('split_line_id')
        context_st_line_id = self._context.get('st_line_id')
        context_active_model = self._context.get('active_model')
        lines = None
        # creating statements with split button
        if context_split_line_id:
            current_st_line = self.env['account.bank.statement.line'].browse(context_split_line_id)
            line_before = self.env['account.bank.statement.line'].search(
                domain=[
                    ('internal_index', '<', current_st_line.internal_index),
                    ('journal_id', '=', current_st_line.journal_id.id),
                    ('statement_id', '!=', current_st_line.statement_id.id),
                    ('statement_id', '!=', False),
                ],
                order='internal_index desc',
                limit=1,
            )
            lines = self.env['account.bank.statement.line'].search(
                domain=[
                    ('internal_index', '<=', current_st_line.internal_index),
                    ('internal_index', '>', line_before.internal_index or ''),
                    ('journal_id', '=', current_st_line.journal_id.id),
                ],
                order='internal_index desc',
            )
        # single line edit
        elif context_st_line_id and len(active_ids) <= 1:
            lines = self.env['account.bank.statement.line'].browse(context_st_line_id)
        # multi edit or action menu
        elif context_active_model == 'account.bank.statement.line' and active_ids or \
            context_st_line_id and len(active_ids) > 1:
            lines = self.env['account.bank.statement.line'].browse(active_ids).sorted()
            if len(lines.journal_id) > 1:
                raise UserError(_("A statement should only contain lines from the same journal."))

        if lines:
            defaults['line_ids'] = [Command.set(lines.ids)]

        print(lines)
        return defaults
