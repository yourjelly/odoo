# -*- coding: utf-8 -*-

from odoo import api, fields, models, _
from odoo.exceptions import ValidationError

class AccountAnalyticLine(models.Model):
    _inherit = 'account.analytic.line'
    _description = 'Analytic Line'

    product_id = fields.Many2one(
        'product.product',
        string='Product',
        check_company=True,
    )
    general_account_id = fields.Many2one(
        'account.account',
        string='Financial Account',
        ondelete='restrict',
        domain="[('deprecated', '=', False)]",
        check_company=True,
        compute='_compute_general_account_id', store=True, readonly=False
    )
    journal_id = fields.Many2one(
        'account.journal',
        string='Financial Journal',
        check_company=True,
        readonly=True,
        related='move_line_id.journal_id',
        store=True,
    )
    partner_id = fields.Many2one(
        readonly=False,
        compute="_compute_partner_id",
        store=True,
    )
    move_line_id = fields.Many2one(
        'account.move.line',
        string='Journal Item',
        ondelete='cascade',
        index=True,
        check_company=True,
    )
    code = fields.Char(size=8)
    ref = fields.Char(string='Ref.')
    category = fields.Selection(selection_add=[('invoice', 'Customer Invoice'), ('vendor_bill', 'Vendor Bill')])

    account_plan_id = fields.Many2one('account.analytic.plan', related="account_id.plan_id")
    account2_id = fields.Many2one(
        'account.analytic.account',
        'Cross Account 1',
        domain="[('plan_id', 'not in', account_id.plan_id.ids)]",  # doesn't work
        ondelete='restrict',
        index=True,
        check_company=True,
    )
    account2_plan_id = fields.Many2one('account.analytic.plan', related="account2_id.plan_id")
    account3_id = fields.Many2one(
        'account.analytic.account',
        'Cross Account 2',
        ondelete='restrict',
        index=True,
        check_company=True,
    )
    account3_plan_id = fields.Many2one('account.analytic.plan', related="account3_id.plan_id")
    percentage = fields.Float(
        inverse="_inverse_percentage"
    )
    state = fields.Selection(
        selection=[
            ('draft', 'Draft'),
            ('posted', 'Posted'),
        ],
        compute="_compute_state",
        store=True,
    )


    @api.depends('move_line_id', 'move_line_id.parent_state')
    def _compute_state(self):
        for analytic_line in self:
            state = 'posted' if analytic_line.move_line_id.parent_state == 'posted' or not analytic_line.move_line_id else 'draft'
            analytic_line.state = state

    @api.onchange('percentage')
    def _inverse_percentage(self):
        for line in self:
            line.amount = -line.move_line_id.balance * line.percentage

    @api.depends('move_line_id')
    def _compute_general_account_id(self):
        for line in self:
            line.general_account_id = line.move_line_id.account_id

    @api.constrains('move_line_id', 'general_account_id')
    def _check_general_account_id(self):
        for line in self:
            if line.move_line_id and line.general_account_id != line.move_line_id.account_id:
                raise ValidationError(_('The journal item is not linked to the correct financial account'))

    @api.depends('move_line_id')
    def _compute_partner_id(self):
        for line in self:
            line.partner_id = line.move_line_id.partner_id or line.partner_id

    @api.onchange('product_id', 'product_uom_id', 'unit_amount', 'currency_id')
    def on_change_unit_amount(self):
        if not self.product_id:
            return {}

        prod_accounts = self.product_id.product_tmpl_id.with_company(self.company_id)._get_product_accounts()
        unit = self.product_uom_id
        account = prod_accounts['expense']
        if not unit or self.product_id.uom_po_id.category_id.id != unit.category_id.id:
            unit = self.product_id.uom_po_id

        # Compute based on pricetype
        amount_unit = self.product_id._price_compute('standard_price', uom=unit)[self.product_id.id]
        amount = amount_unit * self.unit_amount or 0.0
        result = (self.currency_id.round(amount) if self.currency_id else round(amount, 2)) * -1
        self.amount = result
        self.general_account_id = account
        self.product_uom_id = unit

    @api.model
    def view_header_get(self, view_id, view_type):
        if self.env.context.get('account_id'):
            return _(
                "Entries: %(account)s",
                account=self.env['account.analytic.account'].browse(self.env.context['account_id']).name
            )
        return super().view_header_get(view_id, view_type)
