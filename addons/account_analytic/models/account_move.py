# -*- coding: utf-8 -*-

from odoo import api, fields, models, _
import ast

class AccountMove(models.Model):
    _inherit = ['account.move']

    @api.model
    def _get_tax_grouping_key_from_tax_line(self, tax_line):
        grouping_key = super(AccountMove, self)._get_tax_grouping_key_from_tax_line(tax_line)
        grouping_key['analytic_tag_ids'] = [(6, 0, tax_line.tax_line_id.analytic and tax_line.analytic_tag_ids.ids or [])]
        grouping_key['analytic_account_id'] = tax_line.tax_line_id.analytic and tax_line.analytic_account_id.id
        return grouping_key

    @api.model
    def _get_tax_grouping_key_from_base_line(self, base_line, tax_vals):
        grouping_key = super(AccountMove, self)._get_tax_grouping_key_from_base_line(base_line, tax_vals)
        grouping_key['analytic_tag_ids'] = [(6, 0, tax_vals['analytic'] and base_line.analytic_tag_ids.ids or [])]
        grouping_key['analytic_account_id'] = tax_vals['analytic'] and base_line.analytic_account_id.id
        return grouping_key

    def button_draft(self):
        super(AccountMove, self).button_draft()
        for move in self:
            # We remove all the analytics entries for this journal
            move.mapped('line_ids.analytic_line_ids').unlink()

    def _pre_post(self):
        super(AccountMove, self)._pre_post()
        # Create the analytic lines in batch is faster as it leads to less cache invalidation.
        self.mapped('line_ids').create_analytic_lines()

class AccountMoveLine(models.Model):
    _inherit = "account.move.line"
    # ==== Analytic fields ====
    analytic_line_ids = fields.One2many('account.analytic.line', 'move_id', string='Analytic lines')
    analytic_account_id = fields.Many2one('account.analytic.account', string='Analytic Account', index=True)
    analytic_tag_ids = fields.Many2many('account.analytic.tag', string='Analytic Tags')

    # override to add 'analytic_account_id' & 'analytic_tag_ids' to argument
    @api.onchange('amount_currency', 'currency_id', 'debit', 'credit', 'tax_ids', 'account_id', 'analytic_account_id', 'analytic_tag_ids')
    def _onchange_mark_recompute_taxes(self):
        super(AccountMoveLine, self)._onchange_mark_recompute_taxes()

    @api.model
    def _query_get(self, domain=None):
        self.check_access_rights('read')

        context = dict(self._context or {})
        domain = domain or []
        if not isinstance(domain, (list, tuple)):
            domain = ast.literal_eval(domain)

        if context.get('analytic_tag_ids'):
            domain += [('analytic_tag_ids', 'in', context['analytic_tag_ids'].ids)]
        if context.get('analytic_account_ids'):
            domain += [('analytic_account_id', 'in', context['analytic_account_ids'].ids)]

        return super(AccountMoveLine, self)._query_get(domain)

    def _compute_writeoff_counterpart_vals(self, values):
        if 'analytic_account_id' not in values:
            values['analytic_account_id'] = self.env.context.get('analytic_id', False)
        return super(AccountMoveLine, self)._compute_writeoff_counterpart_vals(values)

    def _get_analytic_tag_ids(self):
        self.ensure_one()
        return self.analytic_tag_ids.filtered(lambda r: not r.active_analytic_distribution).ids

    def create_analytic_lines(self):
        """ Create analytic items upon validation of an account.move.line having an analytic account or an analytic distribution.
        """
        lines_to_create_analytic_entries = self.env['account.move.line']
        analytic_line_vals = []
        for obj_line in self:
            for tag in obj_line.analytic_tag_ids.filtered('active_analytic_distribution'):
                for distribution in tag.analytic_distribution_ids:
                    analytic_line_vals.append(obj_line._prepare_analytic_distribution_line(distribution))
            if obj_line.analytic_account_id:
                lines_to_create_analytic_entries |= obj_line

        # create analytic entries in batch
        if lines_to_create_analytic_entries:
            analytic_line_vals += lines_to_create_analytic_entries._prepare_analytic_line()

        self.env['account.analytic.line'].create(analytic_line_vals)

    def _prepare_analytic_line(self):
        """ Prepare the values used to create() an account.analytic.line upon validation of an account.move.line having
            an analytic account. This method is intended to be extended in other modules.
            :return list of values to create analytic.line
            :rtype list
        """
        result = []
        for move_line in self:
            amount = (move_line.credit or 0.0) - (move_line.debit or 0.0)
            default_name = move_line.name or (move_line.ref or '/' + ' -- ' + (move_line.partner_id and move_line.partner_id.name or '/'))
            result.append({
                'name': default_name,
                'date': move_line.date,
                'account_id': move_line.analytic_account_id.id,
                'tag_ids': [(6, 0, move_line._get_analytic_tag_ids())],
                'unit_amount': move_line.quantity,
                'product_id': move_line.product_id and move_line.product_id.id or False,
                'product_uom_id': move_line.product_uom_id and move_line.product_uom_id.id or False,
                'amount': amount,
                'general_account_id': move_line.account_id.id,
                'ref': move_line.ref,
                'move_id': move_line.id,
                'user_id': move_line.move_id.invoice_user_id.id or self._uid,
                'partner_id': move_line.partner_id.id,
                'company_id': move_line.analytic_account_id.company_id.id or self.env.company.id,
            })
        return result

    def _prepare_analytic_distribution_line(self, distribution):
        """ Prepare the values used to create() an account.analytic.line upon validation of an account.move.line having
            analytic tags with analytic distribution.
        """
        self.ensure_one()
        amount = -self.balance * distribution.percentage / 100.0
        default_name = self.name or (self.ref or '/' + ' -- ' + (self.partner_id and self.partner_id.name or '/'))
        return {
            'name': default_name,
            'date': self.date,
            'account_id': distribution.account_id.id,
            'partner_id': self.partner_id.id,
            'tag_ids': [(6, 0, [distribution.tag_id.id] + self._get_analytic_tag_ids())],
            'unit_amount': self.quantity,
            'product_id': self.product_id and self.product_id.id or False,
            'product_uom_id': self.product_uom_id and self.product_uom_id.id or False,
            'amount': amount,
            'general_account_id': self.account_id.id,
            'ref': self.ref,
            'move_id': self.id,
            'user_id': self.move_id.invoice_user_id.id or self._uid,
            'company_id': distribution.account_id.company_id.id or self.env.company.id,
        }

    def _get_cash_basis_entry_params(self, newly_created_move, line, amount, rounded_amt):
        params = super(AccountMoveLine, self)._get_cash_basis_entry_params(newly_created_move, line, amount, rounded_amt)
        params['analytic_account_id'] = line.analytic_account_id.id
        params['analytic_tag_ids'] = line.analytic_tag_ids.ids
        return params

    def _get_cash_basis_account_and_tax_params(self, newly_created_move, line, amount, rounded_amt):
        params = super(AccountMoveLine, self)._get_cash_basis_account_and_tax_params(newly_created_move, line, amount, rounded_amt)
        params['analytic_account_id'] = line.analytic_account_id.id
        params['analytic_tag_ids'] = line.analytic_tag_ids.ids
