# -*- coding: utf-8 -*-
from odoo import api, fields, models, _


class AccountInvoiceTax(models.Model):
    _name = "account.invoice.payment"
    _description = "Invoice Payment Term Lines"
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
        store=True, readonly=False, index=True, tracking=True, ondelete='cascade',
        compute='_compute_account_id',
        check_company=True,
        domain="[('deprecated', '=', False), ('company_id', '=', 'company_id'), ('internal_type', 'in', ('receivable', 'payable'))]")
    name = fields.Char(
        string='Label',
        store=True, readonly=False, tracking=True,
        compute='_compute_name')
    date_maturity = fields.Date(
        string='Due Date',
        index=True, tracking=True,
        help="This field is used for payable and receivable journal entries. You can put the limit date for the payment "
             "of this line.")
    amount_total = fields.Monetary(
        string='Total',
        currency_field='currency_id')

    # ==== Display purpose fields ====
    company_id = fields.Many2one(
        comodel_name='res.company',
        related='invoice_id.company_id')
    currency_id = fields.Many2one(
        comodel_name='res.currency',
        related='invoice_id.currency_id')

    # -------------------------------------------------------------------------
    # COMPUTE METHODS
    # -------------------------------------------------------------------------

    @api.depends('invoice_id.payment_reference')
    def _compute_name(self):
        for line in self:
            line.name = line.invoice_id.payment_reference

    @api.depends('invoice_id.partner_id')
    def _compute_account_id(self):
        need_default_account = {}

        for line in self:
            invoice = line.invoice_id

            if invoice.partner_id:
                if invoice._is_sale_document():
                    line.account_id = invoice.partner_id.with_company(invoice.company_id).property_account_receivable_id
                else:
                    line.account_id = invoice.partner_id.with_company(invoice.company_id).property_account_payable_id
            else:
                account_type = 'receivable' if invoice._is_sale_document() else 'payable'
                key = (invoice.company_id, account_type)
                need_default_account.setdefault(key, self.env['account.invoice.payment'])
                need_default_account[key] |= line

        for key, lines in need_default_account.items():
            company, account_type = key
            domain = [
                ('company_id', '=', company.id),
                ('internal_type', '=', account_type),
            ]
            default_account = self.env['account.account'].search(domain, limit=1)
            for line in lines:
                line.account_id = default_account

    # -------------------------------------------------------------------------
    # SYNCHRONIZATION METHODS
    # -------------------------------------------------------------------------

    def _synchronize_move_line_from_invoice_payment(self):
        self.ensure_one()

        invoice_sign = -1 if self.invoice_id._is_outbound() else 1
        currency = self.invoice_id.currency_id
        company = self.invoice_id.company_id
        amount_currency = invoice_sign * self.amount_total
        balance = currency._convert(amount_currency, company.currency_id, company, self.invoice_id.accounting_date)

        return {
            'invoice_pay_line_id': self.id,
            'name': self.name,
            'account_id': self.account_id.id,
            'partner_id': self.invoice_id.partner_id.commercial_partner_id.id,
            'date_maturity': self.date_maturity,
            'currency_id': currency.id,
            'amount_currency': amount_currency,
            'debit': balance if balance > 0.0 else 0.0,
            'credit': -balance if balance < 0.0 else 0.0,
        }

    def _synchronize_invoice_payment_from_move_line(self):
        self.ensure_one()

        invoice_sign = -1 if self.invoice_id._is_outbound() else 1

        move_line = self.accounting_line_id
        amount_total = invoice_sign * move_line.amount_currency

        return {
            'name': move_line.name,
            'account_id': move_line.account_id.id,
            'date_maturity': self.date_maturity,
            'amount_total': amount_total,
        }
