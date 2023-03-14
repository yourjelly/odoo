# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import json

from odoo import api, fields, models, _, Command
from odoo.exceptions import UserError


class AccountAccountTemplate(models.Model):
    _inherit = "account.account.template"

    def _load_company_accounts(self, account_ref, company):
        res = super()._load_company_accounts(account_ref, company)
        if self == self.env.ref('l10n_in.indian_chart_template_standard'):
            company.write({
                'account_advance_payment_tax_account_id': account_ref.get(self.env.ref('l10n_in_payment_tax.p10058'))
            })
        return res

    def _load(self, company):
        res = super()._load(company)
        if self == self.env.ref('l10n_in.indian_chart_template_standard'):
            miscellaneous_journal = self.env['account.journal'].search([('type', '=', 'general')], limit=1)
            company.write({
                'account_advance_payment_tax_adjustment_journal_id': miscellaneous_journal.id
            })
        return res