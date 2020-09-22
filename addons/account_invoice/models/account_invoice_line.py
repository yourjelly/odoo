# -*- coding: utf-8 -*-
from odoo import api, fields, models, _


class AccountInvoiceLine(models.Model):
    _name = "account.invoice.line"
    _description = "Invoice Lines"
    _inherit = ['account.business.line.mixin']
    _check_company_auto = True

    # == Business fields ==
    invoice_id = fields.Many2one(
        comodel_name='account.invoice',
        index=True, required=True, readonly=True, auto_join=True, ondelete='cascade')
    accounting_line_id = fields.Many2one(
        comodel_name='account.move.line')
    sequence = fields.Integer(
        default=10,
        help="Gives the sequence of this line when displaying the invoice.")
    product_id = fields.Many2one(
        comodel_name='product.product',
        string='Product')
    account_id = fields.Many2one(
        comodel_name='account.account',
        string='Account',
        store=True, readonly=False, index=True, tracking=True, ondelete='cascade',
        check_company=True,
        compute='_compute_account_id',
        domain="[('deprecated', '=', False), ('company_id', '=', company_id), ('is_off_balance', '=', False)]")
    name = fields.Char(
        string='Label',
        store=True, readonly=False, tracking=True,
        compute='_compute_name')
    quantity = fields.Float(
        string='Quantity',
        default=1.0, digits='Product Unit of Measure',
        help="The optional quantity expressed by this line, eg: number of product sold. "
             "The quantity is not a legal requirement but is very useful for some reports.")
    product_uom_id = fields.Many2one(
        comodel_name='uom.uom',
        string='Unit of Measure',
        store=True, readonly=False,
        compute='_compute_product_uom_id',
        domain="[('category_id', '=', product_uom_category_id)]")
    price_unit = fields.Float(
        string='Unit Price',
        store=True, readonly=False,
        compute='_compute_price_unit',
        digits='Product Price')
    discount = fields.Float(
        string='Discount (%)',
        default=0.0, digits='Discount')
    amount_untaxed = fields.Monetary(
        string='Subtotal',
        store=True,
        compute='_compute_amounts',
        currency_field='currency_id')
    amount_total = fields.Monetary(
        string='Total',
        store=True,
        compute='_compute_amounts',
        currency_field='currency_id')
    tax_ids = fields.Many2many(
        comodel_name='account.tax',
        string='Taxes',
        store=True, readonly=False, check_company=True,
        compute='_compute_tax_ids',
        help="Taxes that apply on the base amount")
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
    display_type = fields.Selection(
        selection=[('line_section', "Section"), ('line_note', "Note")],
        default=False,
        help="Technical field for UX purpose.")
    is_rounding_line = fields.Boolean(help="Technical field used to retrieve the cash rounding line.")

    # ==== Display purpose fields ====
    company_id = fields.Many2one(
        comodel_name='res.company',
        related='invoice_id.company_id')
    currency_id = fields.Many2one(
        comodel_name='res.currency',
        related='invoice_id.currency_id')
    product_uom_category_id = fields.Many2one(
        comodel_name='uom.category',
        related='product_id.uom_id.category_id')

    last_onchange_fields = fields.Char(store=False)

    # -------------------------------------------------------------------------
    # INHERIT account.business.line.mixin
    # -------------------------------------------------------------------------

    def _get_product(self):
        # OVERRIDE
        self.ensure_one()
        return self.product_id

    def _get_product_uom(self):
        # OVERRIDE
        self.ensure_one()
        return self.product_uom_id

    def _get_taxes(self):
        # OVERRIDE
        self.ensure_one()
        return self.tax_ids

    def _get_price_unit(self):
        # OVERRIDE
        self.ensure_one()
        return self.price_unit

    def _get_quantity(self):
        # OVERRIDE
        self.ensure_one()
        return self.quantity

    def _get_discount(self):
        # OVERRIDE
        self.ensure_one()
        return self.discount

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

    def _get_fiscal_position(self):
        # OVERRIDE
        self.ensure_one()
        return self.invoice_id.fiscal_position_id

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
    def _get_tax_tracked_fields(self):
        return ['tax_ids', 'amount_untaxed', 'analytic_account_id', 'analytic_tag_ids']

    @api.model
    def _get_cash_rounding_tracked_fields(self):
        return ['amount_untaxed']

    @api.model
    def _get_payment_terms_tracked_fields(self):
        return ['amount_untaxed']

    @api.model
    def _format_business_line_vals(self, vals):
        return {
            'tax_tag_ids': vals['tax_tag_ids'],
        }

    # -------------------------------------------------------------------------
    # ONCHANGE METHODS
    # -------------------------------------------------------------------------

    @api.onchange('account_id')
    def _onchange_account_id(self):
        if self.account_id.tax_ids or not self.tax_ids:
            self.tax_ids = self._get_default_product_taxes()

    # -------------------------------------------------------------------------
    # COMPUTE METHODS
    # -------------------------------------------------------------------------

    @api.depends('product_id')
    def _compute_account_id(self):
        for line in self:
            line.account_id = line._get_default_product_account()

    @api.depends('product_id', 'product_uom_id')
    def _compute_price_unit(self):
        for line in self:
            line.price_unit = line._get_default_product_price_unit()

    @api.depends('product_id')
    def _compute_product_uom_id(self):
        for line in self:
            line.product_uom_id = line._get_default_product_uom()

    @api.depends('product_id')
    def _compute_name(self):
        for line in self:
            line.name = line._get_default_product_name()

    @api.depends('product_id')
    def _compute_tax_ids(self):
        for line in self:
            line.tax_ids = line._get_default_product_taxes()

    @api.depends('quantity', 'discount', 'price_unit', 'tax_ids')
    def _compute_amounts(self):
        for line in self:
            diff_taxes = line._compute_diff_taxes()
            line.amount_untaxed = diff_taxes.get('amount_untaxed', 0.0)
            line.amount_total = diff_taxes.get('amount_total', 0.0)

    @api.depends('product_id', 'account_id', 'invoice_id.partner_id', 'invoice_id.invoice_date')
    def _compute_analytic_account(self):
        for line in self:
            rec = self.env['account.analytic.default'].account_get(
                product_id=line._get_product().id,
                partner_id=line._get_partner().id,
                account_id=line._get_account().id,
                user_id=line.env.uid,
                date=line._get_date(),
                company_id=line._get_company().id,
            )
            line.analytic_account_id = rec.analytic_id if rec else line.analytic_account_id
            line.analytic_tag_ids = rec.analytic_tag_ids if rec else line.analytic_tag_ids

    # -------------------------------------------------------------------------
    # SYNCHRONIZATION METHODS
    # -------------------------------------------------------------------------

    def _synchronize_move_line_from_invoice_line(self):
        self.ensure_one()

        invoice_sign = 1 if self.invoice_id._is_outbound() else -1
        currency = self.invoice_id.currency_id
        company = self.invoice_id.company_id
        amount_currency = invoice_sign * self.amount_untaxed
        balance = currency._convert(amount_currency, company.currency_id, company, self.invoice_id.accounting_date)

        return {
            'invoice_line_id': self.id,
            'name': self.name,
            'account_id': self.account_id.id,
            'partner_id': self.invoice_id.partner_id.commercial_partner_id.id,
            'tax_ids': [(6, 0, self.tax_ids.ids)],
            'tax_tag_ids': [(6, 0, self.tax_tag_ids.ids)],
            'analytic_account_id': self.analytic_account_id.id,
            'analytic_tag_ids': [(6, 0, self.analytic_tag_ids.ids)],
            'currency_id': currency.id,
            'amount_currency': amount_currency,
            'debit': balance if balance > 0.0 else 0.0,
            'credit': -balance if balance < 0.0 else 0.0,
        }

    def _synchronize_invoice_line_from_move_line(self):
        self.ensure_one()

        invoice_sign = 1 if self.invoice_id._is_outbound() else -1

        move_line = self.accounting_line_id
        currency = move_line.currency_id
        amount_untaxed = invoice_sign * move_line.amount_currency

        to_write = {
            'name': move_line.name,
            'account_id': move_line.account_id.id,
            'tax_ids': [(6, 0, move_line.tax_ids.ids)],
            'tax_tag_ids': [(6, 0, move_line.tax_tag_ids.ids)],
            'analytic_account_id': move_line.analytic_account_id.id,
            'analytic_tag_ids': [(6, 0, move_line.analytic_tag_ids.ids)],
        }

        if not currency.is_zero(self.amount_untaxed - amount_untaxed):
            # Avoid rounding issues.
            discount_factor = 1 - (self.discount / 100.0)

            if move_line.tax_ids:

                taxes = move_line.tax_ids.flatten_taxes_hierarchy()
                if taxes and any(tax.price_include for tax in taxes):
                    # Inverse taxes. E.g:
                    #
                    # Price Unit    | Taxes         | Originator Tax    |Price Subtotal     | Price Total
                    # -----------------------------------------------------------------------------------
                    # 110           | 10% incl, 5%  |                   | 100               | 115
                    # 10            |               | 10% incl          | 10                | 10
                    # 5             |               | 5%                | 5                 | 5
                    #
                    # When setting the balance to -200, the expected result is:
                    #
                    # Price Unit    | Taxes         | Originator Tax    |Price Subtotal     | Price Total
                    # -----------------------------------------------------------------------------------
                    # 220           | 10% incl, 5%  |                   | 200               | 230
                    # 20            |               | 10% incl          | 20                | 20
                    # 10            |               | 5%                | 10                | 10
                    taxes_res = taxes._origin.compute_all(amount_untaxed, currency=currency, handle_price_include=False)
                    for tax_res in taxes_res['taxes']:
                        tax = self.env['account.tax'].browse(tax_res['id'])
                        if tax.price_include:
                            amount_untaxed += tax_res['amount']

            if not currency.is_zero(amount_untaxed) and discount_factor:
                # discount != 100%
                to_write.update({
                    'quantity': self.quantity or 1.0,
                    'price_unit': amount_untaxed / discount_factor / (self.quantity or 1.0),
                })
            elif not currency.is_zero(amount_untaxed) and not discount_factor:
                # discount == 100%
                to_write.update({
                    'quantity': self.quantity or 1.0,
                    'discount': 0.0,
                    'price_unit': amount_untaxed / (self.quantity or 1.0),
                })
            elif currency.is_zero(amount_untaxed) and discount_factor:
                # total is zero, price_unit should be zero as well.
                to_write.update({
                    'price_unit': 0.0,
                })

        return to_write

    # -------------------------------------------------------------------------
    # LOW-LEVEL METHODS
    # -------------------------------------------------------------------------

    def _hook_pre_onchange(self, changed_fields):
        # OVERRIDE
        res = super()._hook_pre_onchange(changed_fields)
        self.last_onchange_fields = '-'.join(changed_fields)
        return res
