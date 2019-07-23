# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


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
        related='debit_move_id.currency_id',
        string="Currency of the debit journal item.")
    credit_currency_id = fields.Many2one(
        comodel_name='res.currency',
        store=True,
        related='credit_move_id.currency_id',
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
        for rec in self:
            rec.max_date = max(
                rec.debit_move_id.date,
                rec.credit_move_id.date
            )

    # -------------------------------------------------------------------------
    # LOW-LEVEL METHODS
    # -------------------------------------------------------------------------

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:

            # Fill missing 'debit_amount_currency'.
            if 'debit_amount_currency' not in vals:
                debit_line = self.env['account.move.line'].browse(vals['debit_move_id'])
                credit_line = self.env['account.move.line'].browse(vals['credit_move_id'])
                amount = debit_line.company_currency_id.round(vals['amount'])
                vals['debit_amount_currency'] = debit_line.company_currency_id._convert(
                    amount,
                    debit_line.currency_id,
                    debit_line.company_id,
                    credit_line.date,
                )

            # Fill missing 'credit_amount_currency'.
            if 'credit_amount_currency' not in vals:
                debit_line = self.env['account.move.line'].browse(vals['debit_move_id'])
                credit_line = self.env['account.move.line'].browse(vals['credit_move_id'])
                amount = credit_line.company_currency_id.round(vals['amount'])
                vals['credit_amount_currency'] = credit_line.company_currency_id._convert(
                    amount,
                    credit_line.currency_id,
                    credit_line.company_id,
                    debit_line.date,
                )

        return super().create(vals_list)

    # -------------------------------------------------------------------------
    # RECONCILIATION METHODS
    # -------------------------------------------------------------------------

    def _create_reconciliation_tax_cash_basis_moves(self, amounts_before, amounts_after):
        ''' Create additional journal entries handling cash basis taxes that are taxes that must appear in the VAT
        report only when reconciling using a receivable / payable account.

        :param amounts_before:  The results of the '_get_cash_basis_amounts' method before reconciling the journal items (account.move.line).
        :param amounts_after:   The results of the '_get_cash_basis_amounts' method after reconciling the journal items (account.move.line).
        :return:                The newly created journal entries (account.move).
        '''
        # Step 1: Group by all partials per move and compute values used to perform the step 2.
        # Making this in two steps is needed to take care about rounding issues since we are making some percentages.
        # Then, the last partial making the move completely reconciling regarding the cash basis taxes must use the
        # remaining amount landing on the receivable / payable accounts instead of performing an additional percentage.
        # This part is also complicated because we need to perform the percentage using the company's currency or the
        # foreign's currency depending of the whole reconciliation status.
        to_process = {}
        for partial in self:
            for move in {partial.debit_move_id.move_id, partial.credit_move_id.move_id}:

                if move.id not in amounts_before or all(line.tax_exigible for line in move.line_ids):
                    continue

                # Check the cash basis configuration only when at least one cash basis tax entry need to be created.
                journal = partial.company_id.tax_cash_basis_journal_id

                if not journal:
                    raise UserError(_('There is no tax cash basis journal defined for this company: "%s"'
                                      '\nConfigure it in Accounting/Configuration/Settings') % partial.company_id.name)

                # Collect needed information about move:
                # - to deduct the percentage for each partial.
                # - to take care about rounding issues when the percentage reach 100%.
                if move not in to_process:
                    to_process[move] = {'partials': [], 'journal': journal}

                    if amounts_before[move.id]['currency_id'] == amounts_after[move.id]['currency_id']:
                        # Same sharing the same currency.
                        to_process[move]['currency'] = self.env['res.currency'].browse(amounts_after[move.id]['currency_id'])
                        to_process[move]['residual_delta'] = amounts_after[move.id]['amount_residual_currency'] - amounts_before[move.id]['amount_residual_currency']
                        to_process[move]['balance'] = amounts_after[move.id]['amount_currency']
                        to_process[move]['is_fully_reconciled'] = to_process[move]['currency'].is_zero(amounts_after[move.id]['amount_residual_currency'])
                    else:
                        # At least two involved currencies.
                        to_process[move]['currency'] = partial.company_currency_id
                        to_process[move]['residual_delta'] = amounts_after[move.id]['amount_residual'] - amounts_before[move.id]['amount_residual']
                        to_process[move]['balance'] = amounts_after['balance']
                        to_process[move]['is_fully_reconciled'] = to_process[move]['currency'].is_zero(amounts_after[move.id]['amount_residual'])

                # Compute amount to reconcile for this partial. Since a partial could be done on the same move in
                # debit and credit, take care of counting such partial twice.
                amount = partial.amount_currency if partial.currency_id == to_process[move]['currency'] else partial.amount

                if partial.debit_move_id.move_id == partial.credit_move_id.move_id:
                    amount *= 2

                to_process[move]['partials'].append((partial, amount))

        # Step 2: Create additional journal entries. Take care about rounding issues when the journal entry becomes
        # fully reconciled.
        moves_to_create = []
        to_reconcile = []
        index = 0
        for move, values in to_process.items():

            for partial, amount in values['partials']:
                tax_cash_basis_move_vals = {
                    'date': partial.max_date,
                    'ref': move.name,
                    'journal_id': values['journal'].id,
                    'line_ids': [],
                }

                percentage = amount / values['balance']

                tax_sequence = 10
                base_sequence = tax_sequence + (10 * len(move.line_ids))
                for line in move.line_ids:

                    if line.tax_exigible:
                        continue

                    balance = line.company_currency_id.round(line.balance * percentage)
                    amount_currency = line.currency_id.round(line.amount_currency * percentage)

                    vals_to_copy = {
                        'name': line.name,
                        'account_id': line.account_id.id,
                        'currency_id': line.currency_id.id,
                        'partner_id': line.partner_id.id,
                        'tax_exigible': True,
                    }

                    if line.tax_repartition_line_id:
                        # Tax lines.

                        tax_cash_basis_move_vals['line_ids'] += [
                            (0, 0, {
                                **vals_to_copy,
                                'name': move.name,
                                'debit': -balance if balance < 0.0 else 0.0,
                                'credit': balance if balance > 0.0 else 0.0,
                                'amount_currency': -amount_currency,
                                'analytic_account_id': line.analytic_account_id.id,
                                'analytic_tag_ids': [(6, 0, line.analytic_tag_ids.ids)],
                                'sequence': tax_sequence,
                            }),
                            (0, 0, {
                                **vals_to_copy,
                                'debit': balance if balance > 0.0 else 0.0,
                                'credit': -balance if balance < 0.0 else 0.0,
                                'amount_currency': amount_currency,
                                'tax_base_amount': line.tax_base_amount,
                                'tax_repartition_line_id': line.tax_repartition_line_id.id,
                                'tax_ids': [(6, 0, line.tax_ids.ids)],
                                'tag_ids': [(6, 0, line.tag_ids.ids)],
                                'account_id': line.tax_repartition_line_id.account_id.id or line.account_id.id,
                                'analytic_account_id': line.analytic_account_id.id,
                                'analytic_tag_ids': [(6, 0, line.analytic_tag_ids.ids)],
                                'sequence': tax_sequence + 1,
                            }),
                        ]

                        if line.account_id.reconcile:
                            to_reconcile.append((line, index, tax_sequence))

                        tax_sequence += 2

                    else:
                        # Tax base lines.

                        for tax in line.tax_ids:

                            account = tax.cash_basis_base_account_id or line.account_id

                            tax_cash_basis_move_vals['line_ids'] += [
                                (0, 0, {
                                    **vals_to_copy,
                                    'debit': -balance if balance < 0.0 else 0.0,
                                    'credit': balance if balance > 0.0 else 0.0,
                                    'amount_currency': -amount_currency,
                                    'account_id': account.id,
                                    'tax_ids': [(6, 0, tax.ids)],
                                    'sequence': base_sequence,
                                }),
                                (0, 0, {
                                    **vals_to_copy,
                                    'debit': balance if balance > 0.0 else 0.0,
                                    'credit': -balance if balance < 0.0 else 0.0,
                                    'amount_currency': amount_currency,
                                    'account_id': account.id,
                                    'tax_ids': [(6, 0, tax.ids)],
                                    'sequence': base_sequence + 1,
                                }),
                            ]

                            base_sequence += 2

                if tax_cash_basis_move_vals['line_ids']:
                    moves_to_create.append(tax_cash_basis_move_vals)
                    index += 1

        moves = self.env['account.move'].create(moves_to_create)

        # Reconcile.
        for line, index, sequence in to_reconcile:
            counterpart_line = moves[index].line_ids.filtered(lambda line: line.sequence == sequence)

            # When dealing with tiny amounts, the line could have a zero amount and then, be already reconciled.
            if counterpart_line.reconciled or not counterpart_line.account_id.reconcile:
                continue

            (line + counterpart_line).reconcile2()

        return moves

    def unlink(self):
        """ When removing a partial reconciliation, also unlink its full reconciliation if it exists """
        full_to_unlink = self.env['account.full.reconcile']
        for rec in self:
            if rec.full_reconcile_id:
                full_to_unlink |= rec.full_reconcile_id
        #reverse the tax basis move created at the reconciliation time
        for move in self.env['account.move'].search([('tax_cash_basis_rec_id', 'in', self._ids)]):
            if move.date > (move.company_id.period_lock_date or date.min):
                move._reverse_moves([{'ref': _('Reversal of %s') % move.name}], cancel=True)
            else:
                move._reverse_moves([{'date': fields.Date.today(), 'ref': _('Reversal of %s') % move.name}], cancel=True)

        # Unlink partials then the full in this order to avoid a recursive call to the same partials.
        res = super(AccountPartialReconcile, self).unlink()

        if full_to_unlink:
            full_to_unlink.unlink()

        return res
