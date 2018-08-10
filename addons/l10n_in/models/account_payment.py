# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class AccountAbstractPayment(models.AbstractModel):
    _inherit = "account.abstract.payment"

    @api.model
    def default_get(self, fields):
        rec = super(AccountAbstractPayment, self).default_get(fields)
        active_ids = self.env.context.get('active_ids')
        if not active_ids or self.env.context.get('active_model') != 'account.invoice':
            return rec
        invoices = self.env['account.invoice'].browse(active_ids)
        for inv in invoices:
            if inv.l10n_in_place_of_supply != invoices[0].l10n_in_place_of_supply:
                rec.update({'multi': True})
                break
        return rec

    @api.onchange('partner_id')
    def _onchange_partner_id(self):
        if self.partner_id.state_id.country_id.code == 'IN':
            self.l10n_in_place_of_supply = self.partner_id.state_id
        else:
            self.l10n_in_place_of_supply = self.env.ref('l10n_in.state_in_ot')
        return super(AccountAbstractPayment, self)._onchange_partner_id()


class AccountRegisterPayments(models.TransientModel):
    _inherit = "account.register.payments"

    @api.multi
    def _groupby_invoices(self):
        results = super(AccountRegisterPayments, self)._groupby_invoices()
        new_results = {}
        for key, invoices in results.items():
            for invoice in invoices:
                new_key = (*key, invoice.l10n_in_place_of_supply.id)
                if not new_key in new_results:
                    new_results[new_key] = self.env['account.invoice']
                new_results[new_key] += invoice
        return new_results

    @api.multi
    def _prepare_payment_vals(self, invoices):
        vals = super(AccountRegisterPayments, self)._prepare_payment_vals(invoices)
        vals['l10n_in_place_of_supply'] = invoices[0].l10n_in_place_of_supply.id
        return vals


class AccountPayment(models.Model):
    _inherit = "account.payment"

    @api.model
    def default_get(self, fields):
        rec = super(AccountPayment, self).default_get(fields)
        invoice_defaults = self.resolve_2many_commands('invoice_ids', rec.get('invoice_ids'))
        if invoice_defaults and len(invoice_defaults) == 1:
            invoice = invoice_defaults[0]
            rec['l10n_in_place_of_supply'] = invoice['l10n_in_place_of_supply'][0]
        return rec

    l10n_in_place_of_supply = fields.Many2one('res.country.state',
        string="Place Of Supply", readonly=True, states={'draft': [('readonly', False)]},
        domain=[("country_id.code", "=", "IN")])
    l10n_in_tax_id = fields.Many2one('account.tax', string="Tax", compute="_compute_l10n_in_tax_id", store=True)

    @api.depends('journal_id', 'payment_type')
    def _compute_l10n_in_tax_id(self):
        for record in self:
            if record.payment_type == 'inbound':
                record.l10n_in_tax_id = record.journal_id.company_id.account_sale_tax_id
            if record.payment_type == 'outbound':
                record.l10n_in_tax_id = record.journal_id.company_id.account_purchase_tax_id

    def _get_move_vals(self, journal=None):
        res = super(AccountPayment, self)._get_move_vals(journal=journal)
        res['l10n_in_place_of_supply'] = self.l10n_in_place_of_supply.id
        return res
