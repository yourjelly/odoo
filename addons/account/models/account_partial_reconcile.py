# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
from odoo.exceptions import UserError, ValidationError

from datetime import date


class AccountPartialReconcile(models.Model):
    _name = "account.partial.reconcile"
    _description = "Partial Reconcile"

    # ==== Reconciliation fields ====
    debit_move_id = fields.Many2one(
        comodel_name='account.move.line',
        index=True, required=True)
    credit_move_id = fields.Many2one(
        comodel_name='account.move.line',
        index=True, required=True)
    full_reconcile_id = fields.Many2one(
        comodel_name='account.full.reconcile',
        string="Full Reconcile", copy=False)

    # ==== Currency fields ====
    company_currency_id = fields.Many2one(
        comodel_name='res.currency',
        string="Company Currency",
        related='company_id.currency_id',
        help="Utility field to express amount currency")
    debit_currency_id = fields.Many2one(
        comodel_name='res.currency',
        store=True,
        compute='_compute_debit_currency_id',
        string="Currency of the debit journal item.")
    credit_currency_id = fields.Many2one(
        comodel_name='res.currency',
        store=True,
        compute='_compute_credit_currency_id',
        string="Currency of the credit journal item.")

    # ==== Amount fields ====
    amount = fields.Monetary(
        currency_field='company_currency_id',
        help="Always positive amount concerned by this matching expressed in the company currency.")
    debit_amount_currency = fields.Monetary(
        currency_field='debit_currency_id',
        help="Always positive amount concerned by this matching expressed in the debit line foreign currency.")
    credit_amount_currency = fields.Monetary(
        currency_field='credit_currency_id',
        help="Always positive amount concerned by this matching expressed in the credit line foreign currency.")

    # ==== Other fields ====
    company_id = fields.Many2one(
        comodel_name='res.company',
        string="Company", store=True, readonly=False,
        related='debit_move_id.company_id')
    max_date = fields.Date(
        string="Max Date of Matched Lines", store=True,
        compute='_compute_max_date',
        help="Technical field used to determine at which date this reconciliation needs to be shown on the "
             "aged receivable/payable reports.")

    # -------------------------------------------------------------------------
    # CONSTRAINT METHODS
    # -------------------------------------------------------------------------

    @api.constrains('debit_currency_id', 'credit_currency_id')
    def _check_required_computed_currencies(self):
        bad_partials = self.filtered(lambda partial: not partial.debit_currency_id or not partial.credit_currency_id)
        if bad_partials:
            raise ValidationError(_("Missing foreign currencies on partials having ids: %s") % bad_partials.ids)

    # -------------------------------------------------------------------------
    # COMPUTE METHODS
    # -------------------------------------------------------------------------

    @api.depends('debit_move_id.date', 'credit_move_id.date')
    def _compute_max_date(self):
        for partial in self:
            partial.max_date = max(
                partial.debit_move_id.date,
                partial.credit_move_id.date
            )

    @api.depends('debit_move_id')
    def _compute_debit_currency_id(self):
        for partial in self:
            partial.debit_currency_id = partial.debit_move_id.currency_id \
                                        or partial.debit_move_id.company_currency_id

    @api.depends('credit_move_id')
    def _compute_credit_currency_id(self):
        for partial in self:
            partial.credit_currency_id = partial.credit_move_id.currency_id \
                                        or partial.credit_move_id.company_currency_id

    # -------------------------------------------------------------------------
    # LOW-LEVEL METHODS
    # -------------------------------------------------------------------------

    def unlink(self):
        # OVERRIDE to unlink full reconcile linked to the current partials
        # and reverse the tax cash basis journal entries.

        # Avoid cyclic unlink calls when removing full reconcile.
        if not self:
            return True

        # Reverse all exchange moves at once.
        moves_to_reverse = self.env['account.move'].search([('tax_cash_basis_rec_id', 'in', self.ids)])
        today = fields.Date.today()
        default_values_list = [{
            'date': move.date if move.date > (move.company_id.period_lock_date or date.min) else today,
            'ref': _('Reversal of: %s') % move.name,
        } for move in moves_to_reverse]
        moves_to_reverse._reverse_moves(default_values_list, cancel=True)

        # Unlink partials then the full in this order to avoid a recursive call to the same partials.
        full_to_unlink = self.full_reconcile_id
        res = super().unlink()
        full_to_unlink.unlink()
        return res

    # -------------------------------------------------------------------------
    # RECONCILIATION METHODS
    # -------------------------------------------------------------------------

    @api.model
    def _collect_tax_cash_basis_values_from_move(self, move):
        ''' Collect all information needed to create the tax cash basis journal entries:
        - Determine if a tax cash basis journal entry is needed.
        - Compute the lines to be processed and the amounts needed to compute a percentage.
        :param move:                    An account.move record.
        :return: A dictionary:
            * move:                     The current account.move record passed as parameter.
            * to_process_lines:         An account.move.line recordset being not exigible on the tax report.
            * currency:                 The currency on which the percentage has been computed.
            * total_balance:            sum(payment_term_lines.mapped('balance').
            * total_residual:           sum(payment_term_lines.mapped('amount_residual').
            * total_amount_currency:    sum(payment_term_lines.mapped('amount_currency').
            * total_residual_currency:  sum(payment_term_lines.mapped('amount_residual_currency').
            * is_fully_paid:            A flag indicating the current move is now fully paid.
            * skip_check_rounding:      A flag indicating the code ensuring the full amount is exactly covered by the
                                        tax cash basis journal entries must be skipped because some entries has been
                                        generated before the saas-13.4 and then, has been generated without enough
                                        information to perform this check correctly considering all existing corner
                                        cases.
        '''
        values = {
            'move': move,
            'to_process_lines': self.env['account.move.line'],
            'payment_term_lines': self.env['account.move.line'],
            'total_balance': 0.0,
            'total_residual': 0.0,
            'total_amount_currency': 0.0,
            'total_residual_currency': 0.0,
            'skip_check_rounding': False,
        }

        currencies = set()
        has_term_lines = False
        for line in move.line_ids:
            if line.account_internal_type in ('receivable', 'payable'):
                sign = 1 if line.balance > 0.0 else -1

                if not line.account_id.reconcile:
                    continue

                currencies.add(line.currency_id or line.company_currency_id)
                has_term_lines = True
                values['total_balance'] += sign * line.balance
                values['total_residual'] += sign * line.amount_residual
                values['total_amount_currency'] += sign * line.amount_currency
                values['total_residual_currency'] += sign * line.amount_residual_currency

            elif not line.tax_exigible:

                values['to_process_lines'] += line
                currencies.add(line.currency_id or line.company_currency_id)

        if not values['to_process_lines'] or not has_term_lines:
            return None

        # Compute the currency on which made the percentage.
        if len(currencies) == 1:
            values['currency'] = list(currencies)[0]
        else:
            # Don't support the case where there is multiple involved currencies.
            return None

        # Determine is the move is now fully paid.
        if values['currency'] == move.company_id.currency_id:
            values['is_fully_paid'] = values['currency'].is_zero(values['total_residual'])
        else:
            values['is_fully_paid'] = values['currency'].is_zero(values['total_residual_currency'])

        return values

    @api.model
    def _collect_tax_cash_basis_values_per_partial(self, move_values):
        ''' Compute some useful values on the current partial to create the tax cash basis journal entry of the move
        passed as parameter.
        :param move_values: The result of the _collect_tax_cash_basis_values_per_move method.
        :return:            A dictionary containing:
            * partial:      The current account.partial.reconcile record.
            * percentage:   The percentage to be applied on the current move.
            * payment_rate: The payment rate to perform the currency conversions.
        '''
        self.ensure_one()

        move = move_values['move']

        partial_amount = 0.0
        partial_amount_currency = 0.0
        rate_amount = 0.0
        rate_amount_currency = 0.0
        if self.debit_move_id.move_id == move:
            partial_amount += self.amount
            partial_amount_currency += self.debit_amount_currency
            rate_amount -= self.credit_move_id.balance
            rate_amount_currency -= self.credit_move_id.amount_currency
        if self.credit_move_id.move_id == move:
            partial_amount += self.amount
            partial_amount_currency += self.credit_amount_currency
            rate_amount += self.debit_move_id.balance
            rate_amount_currency += self.debit_move_id.amount_currency

        if move_values['currency'] == move.company_id.currency_id:
            # Percentage made on company's currency.
            percentage = partial_amount / move_values['total_balance']
        else:
            # Percentage made on foreign currency.
            percentage = partial_amount_currency / move_values['total_amount_currency']

        if rate_amount:
            payment_rate = rate_amount_currency / rate_amount
        else:
            payment_rate = 0.0

        return {
            'partial': self,
            'percentage': percentage,
            'payment_rate': payment_rate,
        }

    def _collect_tax_cash_basis_values(self):
        ''' Collect all informations needed to create the tax cash basis journal entries on the current partials.
        :return:    A dictionary mapping each move_id to the result of _collect_tax_cash_basis_values_per_move.
                    Also, some keys are added in each dictionary by this method:
                    * partials:             A list of dictionary, one for each partial to process, created by
                                            the '_collect_tax_cash_basis_values_per_partial' method.
                    * processed_partials:   A list of dictionary, one for each already processed partial in the
                                            past, created by the '_collect_tax_cash_basis_values_per_partial'
                                            method.
                    * cash_basis_moves:     An account.move recordset of all previously created tax cash basis
                                            journal entries for the each move.
        '''
        tax_cash_basis_values_per_move = {}

        for partial in self:
            for move in {partial.debit_move_id.move_id, partial.credit_move_id.move_id}:

                # Collect data about cash basis.
                if move.id not in tax_cash_basis_values_per_move:
                    tax_cash_basis_values_per_move[move.id] = partial._collect_tax_cash_basis_values_from_move(move)

                # Nothing to process on the move.
                if not tax_cash_basis_values_per_move.get(move.id):
                    continue

                # Check the cash basis configuration only when at least one cash basis tax entry need to be created.
                journal = partial.company_id.tax_cash_basis_journal_id

                if not journal:
                    raise UserError(_("There is no tax cash basis journal defined for the '%s' company.\n"
                                      "Configure it in Accounting/Configuration/Settings") % partial.company_id.display_name)

                # Add partials information.
                partial_cash_basis_values = partial._collect_tax_cash_basis_values_per_partial(tax_cash_basis_values_per_move[move.id])
                tax_cash_basis_values_per_move[move.id].setdefault('partials', [])
                tax_cash_basis_values_per_move[move.id]['partials'].append(partial_cash_basis_values)

                # Add a key to contain all previously processed partials coming from old reconciliations.
                tax_cash_basis_values_per_move[move.id].setdefault('processed_partials', [])

                # Add a key to contain all existing tax cash basis moves.
                tax_cash_basis_values_per_move[move.id].setdefault('cash_basis_moves', self.env['account.move'])

        # Clean-up moves having nothing to process.
        tax_cash_basis_values_per_move = {k: v for k, v in tax_cash_basis_values_per_move.items() if v}

        # Collect all passed percentages that will be used to avoid rounding issues.
        # This part is done in a separated step to avoid making a search inside a loop.
        move_ids = list(tax_cash_basis_values_per_move.keys())
        if move_ids:
            previous_tax_cash_basis_moves = self.env['account.move'].search([
                '|',
                ('tax_cash_basis_move_id', 'in', move_ids),
                ('tax_cash_basis_rec_id', 'in', self.ids),
            ])
            for previous_tax_cash_basis_move in previous_tax_cash_basis_moves:
                move = previous_tax_cash_basis_move.tax_cash_basis_move_id

                if move:
                    partial = previous_tax_cash_basis_move.tax_cash_basis_rec_id
                    partial_cash_basis_values = partial._collect_tax_cash_basis_values_per_partial(tax_cash_basis_values_per_move[move.id])

                    tax_cash_basis_values_per_move[move.id]['processed_partials'].append(partial_cash_basis_values)

                    tax_cash_basis_values_per_move[move.id]['cash_basis_moves'] |= previous_tax_cash_basis_move
                else:
                    # Some linked tax cash basis journal entries has been made before the migration in saas-13.4. In
                    # that case, we are not able to fix the eventual rounding issues.
                    partial = previous_tax_cash_basis_move.tax_cash_basis_rec_id
                    for move in {partial.debit_move_id.move_id, partial.credit_move_id.move_id}:
                        if move.id not in tax_cash_basis_values_per_move:
                            continue
                        tax_cash_basis_values_per_move[move.id]['skip_check_rounding'] = True

        return tax_cash_basis_values_per_move

    def _create_tax_cash_basis_moves(self, tax_cash_basis_values_per_move):
        ''' Create the tax cash basis journal entries.
        :param tax_cash_basis_values_per_move: The result of the '_collect_tax_cash_basis_values' method.
        :return: The newly created account.move.
        '''
        moves_to_create = []
        to_reconcile_after = []

        for move_values in tax_cash_basis_values_per_move.values():
            move = move_values['move']

            i = 0
            for partial_values in move_values['partials']:
                partial = partial_values['partial']

                is_last_partial = i == len(move_values['partials']) - 1

                # Init the journal entry.
                move_vals = {
                    'move_type': 'entry',
                    'date': partial.max_date,
                    'ref': move.name,
                    'journal_id': partial.company_id.tax_cash_basis_journal_id.id,
                    'line_ids': [],
                    'tax_cash_basis_rec_id': partial.id,
                    'tax_cash_basis_move_id': move.id,
                }

                # Process lines.
                for line in move_values['to_process_lines']:

                    # /!\ Take care of rounding issues by adding the residual amounts when the journal entry becomes
                    # fully paid.
                    # We need to ensure the whole amount has been covered when the journal entry becomes fully paid.
                    # We also need to take care the amounts never exceed the balance that could happen because the
                    # rounding method is half-up.

                    if move_values['currency'] == move.company_id.currency_id:
                        # Percentage expressed in the company's currency.

                        if move_values['skip_check_rounding']:
                            balance = line.company_currency_id.round(line.balance * partial_values['percentage'])
                        else:
                            residual_balance = line.balance
                            for processed_partial in move_values['processed_partials']:
                                previous_percentage = processed_partial['percentage']
                                residual_balance -= line.company_currency_id.round(line.balance * previous_percentage)

                            if line.balance > 0.0 and residual_balance < 0.0:
                                residual_balance = 0.0
                            elif line.balance < 0.0 and residual_balance > 0.0:
                                residual_balance = 0.0

                            if move_values['is_fully_paid'] and is_last_partial:
                                balance = residual_balance
                            else:
                                balance = line.company_currency_id.round(line.balance * partial_values['percentage'])

                                # Don't change the balance sign.
                                if line.balance > 0.0 and residual_balance - balance < 0.0:
                                    balance = line.balance - residual_balance
                                elif line.balance < 0.0 and residual_balance - balance > 0.0:
                                    balance = line.balance - residual_balance

                        amount_currency = balance

                    else:
                        # Percentage expressed in the foreign currency.

                        if move_values['skip_check_rounding']:
                            amount_currency = line.currency_id.round(line.amount_currency * partial_values['percentage'])
                        else:
                            residual_amount_currency = line.amount_currency
                            for processed_partial in move_values['processed_partials']:
                                previous_percentage = processed_partial['percentage']
                                residual_amount_currency -= line.currency_id.round(line.amount_currency * previous_percentage)

                            if line.amount_currency > 0.0 and residual_amount_currency < 0.0:
                                residual_amount_currency = 0.0
                            elif line.amount_currency < 0.0 and residual_amount_currency > 0.0:
                                residual_amount_currency = 0.0

                            if move_values['is_fully_paid'] and is_last_partial:
                                amount_currency = residual_amount_currency
                            else:
                                amount_currency = line.currency_id.round(line.amount_currency * partial_values['percentage'])

                                # Don't change the amount_currency sign.
                                if line.amount_currency > 0.0 and residual_amount_currency - amount_currency < 0.0:
                                    amount_currency = line.amount_currency - residual_amount_currency
                                elif line.amount_currency < 0.0 and residual_amount_currency - amount_currency > 0.0:
                                    amount_currency = line.amount_currency - residual_amount_currency

                        balance = partial_values['payment_rate'] and amount_currency / partial_values['payment_rate'] or 0.0

                    common_line_vals = {
                        'name': line.name,
                        'currency_id': line.currency_id.id,
                        'partner_id': line.partner_id.id,
                        'tax_exigible': True,
                    }

                    current_sequence = len(move_vals['line_ids'])
                    if line.tax_repartition_line_id:
                        # Tax lines.

                        move_vals['line_ids'] += [
                            (0, 0, {
                                **common_line_vals,
                                'name': move.name,
                                'debit': -balance if balance < 0.0 else 0.0,
                                'credit': balance if balance > 0.0 else 0.0,
                                'amount_currency': -amount_currency,
                                'account_id': line.account_id.id,
                                'analytic_account_id': line.analytic_account_id.id,
                                'analytic_tag_ids': [(6, 0, line.analytic_tag_ids.ids)],
                                'sequence': current_sequence,
                            }),
                            (0, 0, {
                                **common_line_vals,
                                'debit': balance if balance > 0.0 else 0.0,
                                'credit': -balance if balance < 0.0 else 0.0,
                                'amount_currency': amount_currency,
                                'tax_base_amount': line.tax_base_amount,
                                'tax_repartition_line_id': line.tax_repartition_line_id.id,
                                'tax_ids': [(6, 0, line.tax_ids.ids)],
                                'tax_tag_ids': [(6, 0, line.tax_tag_ids.ids)],
                                'account_id': line.tax_repartition_line_id.account_id.id or line.account_id.id,
                                'analytic_account_id': line.analytic_account_id.id,
                                'analytic_tag_ids': [(6, 0, line.analytic_tag_ids.ids)],
                                'sequence': current_sequence + 1,
                            }),
                        ]

                        # Retrieve the lines to reconcile based on the sequence.
                        if line.account_id.reconcile:
                            move_index = len(moves_to_create)
                            to_reconcile_after.append((line, move_index, current_sequence))

                    else:
                        # Tax base lines.

                        for tax in line.tax_ids.flatten_taxes_hierarchy():
                            account = tax.cash_basis_base_account_id or line.account_id
                            if move.move_type in ('out_refund', 'in_refund'):
                                repartition_line_field = 'refund_repartition_line_ids'
                            else:
                                repartition_line_field = 'invoice_repartition_line_ids'
                            base_tax_tag_ids = tax[repartition_line_field].filtered(lambda line: line.repartition_type == 'base').tag_ids

                            move_vals['line_ids'] += [
                                (0, 0, {
                                    **common_line_vals,
                                    'debit': -balance if balance < 0.0 else 0.0,
                                    'credit': balance if balance > 0.0 else 0.0,
                                    'amount_currency': -amount_currency,
                                    'account_id': account.id,
                                    'sequence': current_sequence,
                                }),
                                (0, 0, {
                                    **common_line_vals,
                                    'debit': balance if balance > 0.0 else 0.0,
                                    'credit': -balance if balance < 0.0 else 0.0,
                                    'amount_currency': amount_currency,
                                    'account_id': account.id,
                                    'tax_ids': [(6, 0, tax.ids)],
                                    'tax_tag_ids': [(6, 0, base_tax_tag_ids.ids)],
                                    'sequence': current_sequence + 1,
                                }),
                            ]

                move_values['processed_partials'].append(partial_values)
                moves_to_create.append(move_vals)
                i += 1

        moves = self.env['account.move'].create(moves_to_create)
        moves.post()

        # Update 'cash_basis_moves' key.
        for move in moves:
            tax_cash_basis_values_per_move[move.tax_cash_basis_move_id.id]['cash_basis_moves'] |= move

        # Reconcile.
        for line, move_index, sequence in to_reconcile_after:
            counterpart_line = moves[move_index].line_ids.filtered(lambda line: line.sequence == sequence)

            # When dealing with tiny amounts, the line could have a zero amount and then, be already reconciled.
            if counterpart_line.reconciled:
                continue

            (line + counterpart_line).reconcile()

        return moves
