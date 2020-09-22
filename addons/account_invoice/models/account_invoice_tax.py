# -*- coding: utf-8 -*-
from odoo import api, fields, models, _


class AccountInvoiceTax(models.Model):
    _name = "account.invoice.tax"
    _description = "Invoice Tax Lines"
    _inherit = ['account.business.line.mixin']
    _check_company_auto = True

    # == Business fields ==
    invoice_id = fields.Many2one(
        comodel_name='account.invoice',
        index=True, required=True, readonly=True, auto_join=True, ondelete='cascade')
    accounting_line_id = fields.Many2one(
        comodel_name='account.move.line')
    account_id = fields.Many2one(
        comodel_name='account.account',
        string='Account',
        index=True, tracking=True, ondelete='cascade',
        check_company=True,
        domain="[('deprecated', '=', False), ('company_id', '=', 'company_id'), ('is_off_balance', '=', False)]")
    name = fields.Char(
        string='Label',
        store=True, readonly=False, tracking=True,
        compute='_compute_name')
    amount_tax = fields.Monetary(
        string='Amount Tax',
        currency_field='currency_id')
    tax_base_amount = fields.Monetary(
        string="Base Amount",
        readonly=True,
        currency_field='currency_id')
    tax_ids = fields.Many2many(
        comodel_name='account.tax',
        string='Taxes',
        store=True, readonly=False, check_company=True,
        compute='_compute_tax_ids',
        help="Taxes that apply on the base amount")
    tax_repartition_line_id = fields.Many2one(
        comodel_name='account.tax.repartition.line',
        string="Originator Tax Distribution Line",
        readonly=True, check_company=True, ondelete='restrict',
        help="Tax distribution line that caused the creation of this move line, if any")
    tax_tag_ids = fields.Many2many(
        comodel_name='account.account.tag',
        string="Tax Grids",
        ondelete='restrict', tracking=True,
        help="Tags assigned to this line by the tax creating it, if any. It determines its impact on financial "
             "reports.")
    analytic_account_id = fields.Many2one(
        comodel_name='account.analytic.account',
        string='Analytic Account',
        index=True, store=True, readonly=False, check_company=True,
        compute="_compute_analytic_account")
    analytic_tag_ids = fields.Many2many(
        comodel_name='account.analytic.tag',
        string='Analytic Tags', store=True, readonly=False, check_company=True,
        compute="_compute_analytic_account")
    is_rounding_line = fields.Boolean(help="Technical field used to retrieve the cash rounding line.")

    # ==== Display purpose fields ====
    company_id = fields.Many2one(
        comodel_name='res.company',
        related='invoice_id.company_id')
    currency_id = fields.Many2one(
        comodel_name='res.currency',
        related='invoice_id.currency_id')
    tax_line_id = fields.Many2one(
        comodel_name='account.tax',
        string='Originator Tax',
        compute='_compute_tax_line_id')

    last_onchange_fields = fields.Char(store=False)

    # -------------------------------------------------------------------------
    # INHERIT account.business.line.mixin
    # -------------------------------------------------------------------------

    def _get_taxes(self):
        # OVERRIDE
        self.ensure_one()
        return self.tax_ids

    def _get_partner(self):
        # OVERRIDE
        self.ensure_one()
        return self.invoice_id.partner_id

    def _get_company(self):
        # OVERRIDE
        self.ensure_one()
        return self.company_id

    def _get_currency(self):
        # OVERRIDE
        self.ensure_one()
        return self.currency_id

    def _get_account(self):
        # OVERRIDE
        self.ensure_one()
        return self.account_id

    def _get_analytic_account(self):
        # OVERRIDE
        self.ensure_one()
        return self.analytic_account_id

    def _get_analytic_tags(self):
        # OVERRIDE
        self.ensure_one()
        return self.analytic_tag_ids

    def _get_journal(self):
        # OVERRIDE
        self.ensure_one()
        return self.invoice_id.journal_id

    def _get_date(self):
        # OVERRIDE
        self.ensure_one()
        return self.invoice_id.accounting_date or fields.Date.context_today(self)

    def _get_tax_repartition_line(self):
        # OVERRIDE
        self.ensure_one()
        return self.tax_repartition_line_id

    def _get_tags(self):
        # OVERRIDE
        self.ensure_one()
        return self.tax_tag_ids

    def _get_document_type(self):
        # OVERRIDE
        self.ensure_one()
        return 'sale' if self.invoice_id._is_sale_document() else 'purchase'

    def _is_refund_document(self):
        # OVERRIDE
        self.ensure_one()
        return self.invoice_id._is_refund()

    # -------------------------------------------------------------------------
    # HELPERS
    # -------------------------------------------------------------------------

    @api.model
    def _get_cash_rounding_tracked_fields(self):
        return ['amount_tax']

    @api.model
    def _get_payment_terms_tracked_fields(self):
        return ['amount_tax']

    @api.model
    def _format_business_line_vals(self, vals):
        new_vals = {}
        for field_name in (
                'tax_repartition_line_id', 'account_id', 'analytic_tag_ids', 'analytic_account_id',
                'tax_ids', 'tax_tag_ids', 'tax_base_amount',
        ):
            if field_name in vals:
                new_vals[field_name] = vals[field_name]

        if 'amount' in vals:
            new_vals['amount_tax'] = vals['amount']

        return new_vals

    # -------------------------------------------------------------------------
    # COMPUTE METHODS
    # -------------------------------------------------------------------------

    @api.depends('tax_line_id')
    def _compute_name(self):
        for line in self:
            line.name = line.tax_line_id.name

    @api.depends('tax_repartition_line_id')
    def _compute_tax_line_id(self):
        for line in self:
            rep_line = line.tax_repartition_line_id
            line.tax_line_id = rep_line.invoice_tax_id or rep_line.refund_tax_id

    # -------------------------------------------------------------------------
    # SYNCHRONIZATION METHODS
    # -------------------------------------------------------------------------

    def _synchronize_move_line_from_invoice_tax(self):
        self.ensure_one()

        invoice_sign = 1 if self.invoice_id._is_outbound() else -1
        currency = self.invoice_id.currency_id
        company = self.invoice_id.company_id
        amount_currency = invoice_sign * self.amount_tax
        balance = currency._convert(amount_currency, company.currency_id, company, self.invoice_id.accounting_date)
        tax_base_amount = currency._convert(self.tax_base_amount, company.currency_id, company, self.invoice_id.accounting_date)

        return {
            'invoice_tax_line_id': self.id,
            'name': self.name,
            'account_id': self.account_id.id,
            'partner_id': self.invoice_id.partner_id.commercial_partner_id.id,
            'tax_ids': [(6, 0, self.tax_ids.ids)],
            'tax_tag_ids': [(6, 0, self.tax_tag_ids.ids)],
            'tax_repartition_line_id': self.tax_repartition_line_id,
            'analytic_account_id': self.analytic_account_id.id,
            'analytic_tag_ids': [(6, 0, self.analytic_tag_ids.ids)],
            'currency_id': currency.id,
            'amount_currency': amount_currency,
            'debit': balance if balance > 0.0 else 0.0,
            'credit': -balance if balance < 0.0 else 0.0,
            'tax_base_amount': tax_base_amount,
        }

    def _synchronize_invoice_tax_from_move_line(self):
        self.ensure_one()

        invoice_sign = 1 if self.invoice_id._is_outbound() else -1

        move_line = self.accounting_line_id
        amount_tax = invoice_sign * move_line.amount_currency

        return {
            'name': move_line.name,
            'account_id': move_line.account_id.id,
            'tax_ids': [(6, 0, move_line.tax_ids.ids)],
            'tax_tag_ids': [(6, 0, move_line.tax_tag_ids.ids)],
            'tax_repartition_line_id': move_line.tax_repartition_line_id,
            'analytic_account_id': move_line.analytic_account_id.id,
            'analytic_tag_ids': [(6, 0, move_line.analytic_tag_ids.ids)],
            'amount_tax': amount_tax,
        }

    # -------------------------------------------------------------------------
    # LOW-LEVEL METHODS
    # -------------------------------------------------------------------------

    def _hook_pre_onchange(self, changed_fields):
        # OVERRIDE
        res = super()._hook_pre_onchange(changed_fields)
        self.last_onchange_fields = '-'.join(changed_fields)
        return res
