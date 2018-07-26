# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class AccountAbstractPayment(models.AbstractModel):
    _inherit = "account.abstract.payment"

    @api.model
    def default_get(self, fields):
        """Update multi payment.
            If l10n_in_gstin_partner_id is diffrent in selected invoices then active multi.
            Because GSTIN(vat) is diffrent so payment record is also unique by l10n_in_gstin_partner_id.
        """
        rec = super(AccountAbstractPayment, self).default_get(fields)
        active_ids = self.env.context.get('active_ids')
        if active_ids and self.env.context.get('active_model') == 'account.invoice':
            invoices = self.env['account.invoice'].browse(active_ids)
            if any(inv.l10n_in_gstin_partner_id != invoices[0].l10n_in_gstin_partner_id for inv in invoices):
                rec.update({'multi': True})
        return rec


class AccountRegisterPayments(models.TransientModel):
    _inherit = "account.register.payments"

    @api.multi
    def _groupby_invoices(self):
        """Set new key base on l10n_in_gstin_partner_id so payment record must be respective to l10n_in_gstin_partner_id.
        Because GSTIN(vat) is diffrent so payment record is respective to l10n_in_gstin_partner_id.
        """
        results = super(AccountRegisterPayments, self)._groupby_invoices()
        new_results = {}
        for key, invoices in results.items():
            for invoice in invoices:
                new_key = (*key, invoice.l10n_in_gstin_partner_id.id)
                if not new_key in new_results:
                    new_results[new_key] = self.env['account.invoice']
                new_results[new_key] += invoice
        return new_results

    @api.multi
    def _prepare_payment_vals(self, invoices):
        vals = super(AccountRegisterPayments, self)._prepare_payment_vals(invoices)
        vals['l10n_in_gstin_partner_id'] = invoices[0].l10n_in_gstin_partner_id.id
        return vals


class AccountPayment(models.Model):
    _inherit = "account.payment"

    @api.model
    def default_get(self, fields):
        rec = super(AccountPayment, self).default_get(fields)
        invoice_defaults = self.resolve_2many_commands('invoice_ids', rec.get('invoice_ids'))
        if invoice_defaults and len(invoice_defaults) == 1:
            invoice = invoice_defaults[0]
            rec['l10n_in_gstin_partner_id'] = invoice['l10n_in_gstin_partner_id'][0]
        return rec

    l10n_in_gstin_partner_id = fields.Many2one(
        'res.partner',
        string="GSTIN",
        required=True,
        default=lambda self: self.env['res.company']._company_default_get('account.payment').partner_id,
        readonly=True, states={'draft': [('readonly', False)]}
        )

    @api.onchange('journal_id')
    def _onchange_journal(self):
        res = super(AccountPayment, self)._onchange_journal()
        self.l10n_in_gstin_partner_id = self.journal_id.company_id.partner_id
        return res

    def _get_move_vals(self, journal=None):
        res = super(AccountPayment, self)._get_move_vals(journal=journal)
        res['l10n_in_gstin_partner_id'] = self.l10n_in_gstin_partner_id.id
        return res
