# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
from odoo.exceptions import UserError


class AccountMoveInheritsMixin(models.AbstractModel):
    _name = "account.move.inherits.mixin"
    _inherits = {'account.move': 'move_id'}
    _description = "On-the-fly editable journal entry"

    move_id = fields.Many2one(
        comodel_name='account.move',
        string="Journal Entry",
        required=True, readonly=True, ondelete='cascade')

    # -------------------------------------------------------------------------
    # SYNCHRONIZATION
    # -------------------------------------------------------------------------

    def _recompute_preview_from_business_model(self, extra_param=None):
        # TO BE OVERRIDDEN
        self.ensure_one()
        return []

    def _recompute_business_model_from_preview(self):
        # TO BE OVERRIDDEN
        self.ensure_one()

    def _check_preview_consistency(self):
        # TO BE OVERRIDDEN
        self.ensure_one()
        return None

    def _synchronize_from_moves(self, changed_fields):
        fake_line_ids_field = self._fields['fake_line_ids']
        line_ids_field = self._fields['line_ids']

        for record in self.with_context(skip_account_move_synchronization=True):
            cache_def = line_ids_field.convert_to_cache(record.line_ids, record, validate=False)
            self.env.cache.set(record, fake_line_ids_field, cache_def)
            warning = record._check_preview_consistency()
            if warning:
                raise UserError(warning)
            record._recompute_business_model_from_preview()

    # -------------------------------------------------------------------------
    # COMPUTE METHODS
    # -------------------------------------------------------------------------

    @api.depends('date', 'journal_id', 'company_id')
    def _compute_fake_line_ids(self):
        # TO BE OVERRIDDEN
        for record in self:
            record.fake_line_ids = [(5, 0)] + [(0, 0, vals) for vals in record._recompute_preview_from_business_model()]

    # -------------------------------------------------------------------------
    # ONCHANGE METHODS
    # -------------------------------------------------------------------------

    @api.onchange('fake_line_ids')
    def _onchange_line_ids(self):
        warning = self._check_preview_consistency()
        if warning:
            return {'warning': {'title': warning}}

        if not self.fake_line_ids:
            return {'warning': {'title': _("For some reason, the preview is unavailable.")}}

        self._recompute_business_model_from_preview()

    # -------------------------------------------------------------------------
    # LOW-LEVEL METHODS
    # -------------------------------------------------------------------------

    def read(self, fields=None, load='_classic_read'):
        # OVERRIDE
        fake_line_ids_in_fields = 'fake_line_ids' in fields if fields else False
        line_ids_in_fields = 'line_ids' in fields if fields else False

        if fake_line_ids_in_fields:
            fields = list(fields)
            fields.remove('fake_line_ids')
            if not line_ids_in_fields:
                fields.append('line_ids')

        res = super(AccountMoveInheritsMixin, self).read(fields=fields, load=load)

        if fake_line_ids_in_fields:
            for vals in res:
                if line_ids_in_fields:
                    line_ids = vals['line_ids']
                else:
                    line_ids = vals.pop('line_ids')

                vals['fake_line_ids'] = line_ids

        return res

    @api.model_create_multi
    def create(self, vals_list):
        # OVERRIDE
        extra_params = [[False, None] for i in range(len(vals_list))]

        for i, vals in enumerate(vals_list):
            if 'fake_line_ids' in vals and 'line_ids' not in vals:
                vals['line_ids'] = vals['fake_line_ids']
            elif 'fake_line_ids' not in vals and 'line_ids' not in vals:
                extra_params[i][0] = True
            vals.pop('fake_line_ids', None)
            extra_params[i][1] = vals.pop('__preview_extra_param', None)

        self_ctx = self.with_context(skip_account_move_synchronization=True)
        records = super(AccountMoveInheritsMixin, self_ctx).create(vals_list)

        for i, record in enumerate(records):
            if not extra_params[i][0]:
                continue

            record.write({'line_ids': [(0, 0, vals) for vals in record._recompute_preview_from_business_model(extra_param=extra_params[i][1])]})

        return records.with_context(skip_account_move_synchronization=False)

    def write(self, vals):
        # OVERRIDE
        records = self.with_context(skip_account_move_synchronization=True)

        use_default_fake_lines = False
        extra_param = vals.pop('__preview_extra_param', None)
        if 'fake_line_ids' in vals and 'line_ids' not in vals:
            vals['line_ids'] = vals['fake_line_ids']
        elif 'fake_line_ids' not in vals and 'line_ids' not in vals:
            # Ensure the fake lines are cached.
            self.fake_line_ids.ids
            use_default_fake_lines = True
        vals.pop('fake_line_ids', None)

        res = super(AccountMoveInheritsMixin, records).write(vals)

        if use_default_fake_lines and not self._context.get('skip_account_move_synchronization', False):
            for record in records:
                # Something triggered the recomputation of 'fake_line_ids' since the values is no longer
                # into the cache because this is a not stored field.
                if 'fake_line_ids' not in record._cache:
                    record.move_id.write({'line_ids': [(5, 0)] + [(0, 0, {
                        **vals,
                        'move_id': record.move_id.id,
                    }) for vals in record._recompute_preview_from_business_model(extra_param=extra_param)]})

        return res

    def unlink(self):
        # OVERRIDE.
        moves = self.with_context(force_delete=True).move_id
        res = super().unlink()
        moves.unlink()
        return res


class AccountMoveLinePreviewMixin(models.AbstractModel):
    _name = "account.move.line.preview.mixin"
    _description = "On-the-fly editable journal items"
    _table = 'account_move_line'

    name = fields.Char(string="Label")
    debit = fields.Monetary(
        string="Debit",
        readonly=False,
        compute='_compute_from_amount_currency',
        currency_field='company_currency_id')
    credit = fields.Monetary(
        string="Credit",
        readonly=False,
        compute='_compute_from_amount_currency',
        currency_field='company_currency_id')
    amount_currency = fields.Monetary(
        string="Amount in Currency",
        currency_field='currency_id')
    partner_id = fields.Many2one(
        comodel_name='res.partner',
        string="Partner")
    currency_id = fields.Many2one(
        comodel_name='res.currency',
        string="Currency",
        required=True)
    account_id = fields.Many2one(
        comodel_name='account.account',
        string="Account",
        required=True, index=True, ondelete='cascade',
        domain="[('deprecated', '=', False), ('company_id', '=', company_id)]")

    company_id = fields.Many2one(comodel_name='res.company', required=True)
    date = fields.Date(required=True)
    company_currency_id = fields.Many2one(comodel_name='res.currency', required=True)

    # -------------------------------------------------------------------------
    # COMPUTE METHODS
    # -------------------------------------------------------------------------

    @api.depends('date', 'amount_currency', 'company_currency_id', 'currency_id')
    def _compute_from_amount_currency(self):
        for line in self:
            parent_date = line.date or fields.Date.context_today(line)
            balance = line.currency_id._convert(line.amount_currency, line.company_currency_id, line.company_id, parent_date)
            line.debit = balance if balance > 0.0 else 0.0
            line.credit = -balance if balance < 0.0 else 0.0

    # -------------------------------------------------------------------------
    # ONCHANGE METHODS
    # -------------------------------------------------------------------------

    def _onchange_balance(self):
        if self.currency_id == self.company_currency_id:
            self.amount_currency = self.debit - self.credit

    @api.onchange('debit')
    def _onchange_debit(self):
        self.credit = 0.0
        self._onchange_balance()

    @api.onchange('credit')
    def _onchange_credit(self):
        self.debit = 0.0
        self._onchange_balance()
