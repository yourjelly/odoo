from exceptions import UserError, ValidationError
from odoo import models, fields, api, _
from tools import float_is_zero, formatLang


class CashBoxStatement(models.Model):
    _name = 'pos.cashbox.statement'
    _description = "Cash Box Statement"
    _order = "date desc, name desc, id desc"
    _inherit = ['mail.thread', 'sequence.mixin']
    _check_company_auto = True
    _sequence_index = "journal_id"

    # -------------------------------------------------------------------------
    #                            DEFAULT METHODS
    # -------------------------------------------------------------------------

    @api.model
    def _default_journal(self):
        return self.env['account.journal'].search([
            ('type', '=', 'cash'),
            ('company_id', '=', self.env.company.id),
        ], limit=1)

    # -------------------------------------------------------------------------
    #                                 FIELDS
    # -------------------------------------------------------------------------

    account_id = fields.Many2one(
        comodel_name='account.account',
        related='journal_id.default_account_id',
        readonly=True,
    )
    all_lines_reconciled = fields.Boolean(
        compute='_compute_all_lines_reconciled',
        help="Technical field indicating if all statement lines are fully reconciled.",
    )
    balance_end = fields.Monetary(
        string='Computed Balance',
        compute='_compute_end_fields',
        store=True,
        help='Balance as calculated based on Opening Balance and transaction lines',
    )
    balance_end_real = fields.Monetary(
        string='Ending Balance',
        states={'confirm': [('readonly', True)]},
        tracking=True,
    )
    balance_start = fields.Monetary(
        string='Starting Balance',
        related='previous_statement_id.balance_end_real',
        readonly=True,
        store=True,
        tracking=True,
    )
    cashbox_end_id = fields.Many2one(
        comodel_name='pos.cashbox',
        string="Ending Cashbox",
    )
    cashbox_start_id = fields.Many2one(
        comodel_name='pos.cashbox',
        string="Starting Cashbox",
    )
    company_id = fields.Many2one(
        comodel_name='res.company',
        related='journal_id.company_id',
        string='Company',
        store=True,
        readonly=True,
    )
    country_code = fields.Char(related='company_id.account_fiscal_country_id.code')
    currency_id = fields.Many2one(
        comodel_name='res.currency',
        compute='_compute_currency',
        store=True,
    )
    date = fields.Date(
        required=True,
        states={'confirm': [('readonly', True)]},
        index=True,
        copy=False,
        default=fields.Date.context_today,
    )
    date_done = fields.Datetime(string="Closed On")
    difference = fields.Monetary(
        compute='_compute_end_fields',
        store=True,
        help="Difference between the computed ending balance and the specified ending balance.",
    )
    is_difference_zero = fields.Boolean(
        compute='_is_difference_zero',
        string='Is zero',
        help="Check if difference is zero.",
    )
    is_valid_balance_start = fields.Boolean(
        string="Is Valid Balance Start",
        store=True,
        compute="_compute_is_valid_balance_start",
        help="Technical field to display a warning message in case starting balance is"
             " different than previous ending balance",
    )
    journal_id = fields.Many2one(
        comodel_name='account.journal',
        string='Journal',
        required=True,
        states={'confirm': [('readonly', True)]},
        default=_default_journal,
        check_company=True,
    )
    line_ids = fields.One2many(
        comodel_name='account.bank.statement.line',
        inverse_name='statement_id',
        string='Statement lines',
        states={'confirm': [('readonly', True)]},
        copy=True,
    )
    move_line_count = fields.Integer(compute="_compute_move_line_count")
    move_line_ids = fields.One2many(
        comodel_name='account.move.line',
        inverse_name='statement_id',
        string='Entry lines',
        states={'confirm': [('readonly', True)]},
    )
    name = fields.Char(
        string='Reference',
        states={'open': [('readonly', False)]},
        copy=False,
        readonly=True,
    )
    pos_session_id = fields.Many2one(
        comodel_name='pos.session',
        string="Session",
        copy=False,
    )
    previous_statement_id = fields.Many2one(
        comodel_name='pos.cashbox.statement',
        help='technical field to compute starting balance correctly',
        compute='_compute_previous_statement_id',
        store=True,
    )
    reference = fields.Char(
        string='External Reference',
        states={'open': [('readonly', False)]},
        copy=False,
        readonly=True,
        help="Used to hold the reference of the external mean that created this statement (name of imported file,"
             " reference of online synchronization...)",
    )
    state = fields.Selection(
        string='Status',
        required=True,
        readonly=True,
        copy=False,
        tracking=True,
        selection=[
            ('open', 'New'),
            ('posted', 'Processing'),
            ('confirm', 'Validated'),
        ],
        default='open',
        help="The current state of your cash statement:"
             "- New: Fully editable with draft Journal Entries."
             "- Processing: No longer editable with posted Journal entries, ready for the reconciliation."
             "- Validated: All lines are reconciled. There is nothing left to process.",
    )
    total_entry_encoding = fields.Monetary(
        string='Transactions Subtotal',
        compute='_compute_end_fields',
        store=True,
        help="Total of transaction lines.",
    )
    user_id = fields.Many2one(
        comodel_name='res.users',
        string='Responsible',
        required=False,
        default=lambda self: self.env.user,
    )

    # -------------------------------------------------------------------------
    #                                 COMPUTE METHODS
    # -------------------------------------------------------------------------

    @api.depends('line_ids.is_reconciled')
    def _compute_all_lines_reconciled(self):
        for statement in self:
            statement.all_lines_reconciled = all(st_line.is_reconciled for st_line in statement.line_ids)

    @api.depends('journal_id')
    def _compute_currency(self):
        for statement in self:
            statement.currency_id = statement.journal_id.currency_id or statement.company_id.currency_id

    @api.depends('line_ids', 'balance_start', 'line_ids.amount', 'balance_end_real')
    def _compute_end_fields(self):
        for statement in self:
            statement.total_entry_encoding = sum([line.amount for line in statement.line_ids])
            statement.balance_end = statement.balance_start + statement.total_entry_encoding
            statement.difference = statement.balance_end_real - statement.balance_end

    @api.depends('balance_start', 'previous_statement_id')
    def _compute_is_valid_balance_start(self):
        for bnk in self:
            bnk.is_valid_balance_start = (
                bnk.currency_id.is_zero(
                    bnk.balance_start - bnk.previous_statement_id.balance_end_real
                )
                if bnk.previous_statement_id
                else True
            )

    @api.depends('move_line_ids')
    def _compute_move_line_count(self):
        for statement in self:
            statement.move_line_count = len(statement.move_line_ids)

    @api.depends('date', 'journal_id')
    def _compute_previous_statement_id(self):
        for st in self:
            # Search for the previous statement
            domain = [('date', '<=', st.date), ('journal_id', '=', st.journal_id.id)]
            # The reason why we have to perform this test is because we have two use cases here:
            # First one is in case we are creating a new record, in that case that new record does
            # not have any id yet. However, if we are updating an existing record, the domain date <= st.date
            # will find the record itself, so we have to add a condition in the search to ignore self.id
            if not isinstance(st.id, models.NewId):
                domain.extend(['|', '&', ('id', '<', st.id), ('date', '=', st.date), '&', ('id', '!=', st.id),
                               ('date', '!=', st.date)])
            previous_statement = self.search(domain, limit=1, order='date desc, id desc')
            st.previous_statement_id = previous_statement.id

    # -------------------------------------------------------------------------
    #                                 SELECTION METHODS
    # -------------------------------------------------------------------------

    # -------------------------------------------------------------------------
    #                                 CONSTRAIN METHODS
    # -------------------------------------------------------------------------
    @api.constrains('journal_id')
    def _check_journal(self):
        for statement in self:
            if any(st_line.journal_id != statement.journal_id for st_line in statement.line_ids):
                raise ValidationError(
                    _('The journal of a bank statement line must always be the same as the bank statement one.'))

    # -------------------------------------------------------------------------
    #                                 ONCHANGE METHODS
    # -------------------------------------------------------------------------
    @api.onchange('journal_id')
    def onchange_journal_id(self):
        for st_line in self.line_ids:
            st_line.journal_id = self.journal_id
            st_line.currency_id = self.journal_id.currency_id or self.company_id.currency_id

    def _is_difference_zero(self):
        for bank_stmt in self:
            bank_stmt.is_difference_zero = float_is_zero(bank_stmt.difference,
                                                         precision_digits=bank_stmt.currency_id.decimal_places)

    # -------------------------------------------------------------------------
    #                                 CRUD METHODS
    # -------------------------------------------------------------------------
    def write(self, values):
        res = super().write(values)
        if values.get('date') or values.get('journal'):
            # If we are changing the date or journal of a cash statement, we have to change its previous_statement_id.
            # This is done automatically using the compute function, but we also have to change the
            # previous_statement_id of records that were previously pointing toward us and records that were pointing
            # towards our new previous_statement_id. This is done here by marking those record as needing to be
            # recomputed.
            # Note that marking the field is not enough as we also have to recompute all its other fields that are
            # depending on 'previous_statement_id' hence the need to call modified afterwards.
            to_recompute = self.search([('previous_statement_id', 'in', self.ids), ('id', 'not in', self.ids),
                                        ('journal_id', 'in', self.journal_id.ids)])
            if to_recompute:
                self.env.add_to_compute(self._fields['previous_statement_id'], to_recompute)
                to_recompute.modified(['previous_statement_id'])
            next_statements_to_recompute = self.search(
                [('previous_statement_id', 'in', self.previous_statement_id.ids),
                 ('id', 'not in', self.ids),
                 ('journal_id', 'in', self.journal_id.ids)])
            if next_statements_to_recompute:
                self.env.add_to_compute(self._fields['previous_statement_id'], next_statements_to_recompute)
                next_statements_to_recompute.modified(['previous_statement_id'])
        return res

    # TODO:poma remove it because we cannot create a cash statement in the past
    @api.model_create_multi
    def create(self, values):
        res = super().create(values)
        # Upon bank stmt creation, it is possible that the statement is inserted between two other statements and not at the end
        # In that case, we have to search for statement that are pointing to the same previous_statement_id as ourselve in order to
        # change their previous_statement_id to us. This is done by marking the field 'previous_statement_id' to be recomputed for such records.
        # Note that marking the field is not enough as we also have to recompute all its other fields that are depending on 'previous_statement_id'
        # hence the need to call modified afterwards.
        # The reason we are doing this here and not in a compute field is that it is not easy to write dependencies for such field.
        next_statements_to_recompute = self.search(
            [('previous_statement_id', 'in', [st.previous_statement_id.id for st in res]), ('id', 'not in', res.ids),
             ('journal_id', 'in', res.journal_id.ids)])
        if next_statements_to_recompute:
            self.env.add_to_compute(self._fields['previous_statement_id'], next_statements_to_recompute)
            next_statements_to_recompute.modified(['previous_statement_id'])
        return res

    @api.ondelete(at_uninstall=False)
    def _unlink_except_linked_to_pos_session(self):
        for bs in self:
            if bs.pos_session_id:
                raise UserError(_("You cannot delete a bank statement linked to Point of Sale session."))

    @api.ondelete(at_uninstall=False)
    def _unlink_only_if_open(self):
        for statement in self:
            if statement.state != 'open':
                raise UserError(
                    _('In order to delete a bank statement, you must first cancel it to delete related journal items.'))

    def unlink(self):
        for statement in self:
            # Explicitly unlink bank statement lines so it will check that the related journal entries have been deleted first
            statement.line_ids.unlink()
            # Some other bank statements might be link to this one, so in that case we have to switch the previous_statement_id
            # from that statement to the one linked to this statement
            next_statement = self.search(
                [('previous_statement_id', '=', statement.id), ('journal_id', '=', statement.journal_id.id)])
            if next_statement:
                next_statement.previous_statement_id = statement.previous_statement_id
        return super().unlink()

    def _check_balance_end_real_same_as_computed(self):
        """ Check the balance_end_real (encoded manually by the user) is equals to the balance_end (computed by odoo).
        In case of a cash statement, the different is set automatically to a profit/loss account.
        """
        for stmt in self:
            if not stmt.currency_id.is_zero(stmt.difference):
                st_line_vals = {
                    'statement_id': stmt.id,
                    'journal_id': stmt.journal_id.id,
                    'amount': stmt.difference,
                    'date': stmt.date,
                }

                if stmt.difference < 0.0:
                    if not stmt.journal_id.loss_account_id:
                        raise UserError(
                            _('Please go on the %s journal and define a Loss Account. This account will be used to record cash difference.',
                              stmt.journal_id.name))

                    st_line_vals['payment_ref'] = _("Cash difference observed during the counting (Loss)")
                    st_line_vals['counterpart_account_id'] = stmt.journal_id.loss_account_id.id
                else:
                    # statement.difference > 0.0
                    if not stmt.journal_id.profit_account_id:
                        raise UserError(
                            _('Please go on the %s journal and define a Profit Account. This account will be used to record cash difference.',
                              stmt.journal_id.name))

                    st_line_vals['payment_ref'] = _("Cash difference observed during the counting (Profit)")
                    st_line_vals['counterpart_account_id'] = stmt.journal_id.profit_account_id.id

                self.env['account.bank.statement.line'].create(st_line_vals)

        return True

    # -------------------------------------------------------------------------
    #                             ACTION METHODS
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
                'res_model': 'pos.cashbox',
                'view_id': self.env.ref('account.view_account_bnk_stmt_cashbox_footer').id,
                'type': 'ir.actions.act_window',
                'res_id': cashbox_id,
                'context': context,
                'target': 'new'
            }

            return action

    def button_post(self):
        """ Move the bank statements from 'draft' to 'posted'. """
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
        if not self.currency_id.is_zero(self.difference):
            return self.env['ir.actions.act_window']._for_xml_id('account.action_view_account_bnk_stmt_check')

        return self.button_validate()

    def button_reopen(self):
        """ Move the bank statements back to the 'open' state. """
        if any(statement.state == 'draft' for statement in self):
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

    def button_validate_or_action(self):  # OVERRIDE to check the consistency of the statement's state regarding the session's state.
        for statement in self:
            if statement.pos_session_id.state in ('opened', 'closing_control') and statement.state == 'open':
                raise UserError(
                    _("You can't validate a bank statement that is used in an opened Session of a Point of Sale."))
        return super().button_validate_or_action()

    # -------------------------------------------------------------------------
    #                             PRIVATE METHODS
    # -------------------------------------------------------------------------

    def _get_last_sequence_domain(self, relaxed=False):
        self.ensure_one()
        where_string = "WHERE journal_id = %(journal_id)s AND name != '/'"
        param = {'journal_id': self.journal_id.id}

        if not relaxed:
            domain = [('journal_id', '=', self.journal_id.id), ('id', '!=', self.id or self._origin.id),
                      ('name', '!=', False)]
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
