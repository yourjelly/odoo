# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _


class AccountMove(models.Model):
    _inherit = "account.payment"

    l10n_in_edi_tax_ids = fields.Many2many(
        'account.tax', 'l10n_in_edi_account_payment_taxes_rel',
        'payment_id', 'tax_id', string='Taxes',
    )
    # Technical field to filter out the sales/purchase taxes based on payment `Type` selection
    l10n_in_edi_tax_type = fields.Selection([
        ('sale', 'Sale'), ('purchase', 'Purchase')
    ], compute='_compute_tax_type')

    @api.depends('payment_type')
    def _compute_tax_type(self):
        for payment in self:
            payment.l10n_in_edi_tax_type = 'purchase' if payment.payment_type == 'outbound' else 'sale'

    @api.onchange('payment_type')
    def _onchange_payment_type(self):
        self.l10n_in_edi_tax_ids = False
