# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models, fields


class AccountChartTemplate(models.Model):
    _inherit = 'account.chart.template'

    def get_countries_posting_at_bank_rec(self):
        rslt = super(AccountChartTemplate, self).get_countries_posting_at_bank_rec()
        rslt.append('LU')
        return rslt

    @api.model
    def _prepare_all_journals(self, acc_template_ref, company, journals_dict=None):
        journal_data = super(AccountChartTemplate, self)._prepare_all_journals(
            acc_template_ref, company, journals_dict)
        account = self.env.ref('l10n_lu.lu_2020_account_703001')
        for journal in journal_data:
            if company.country_id == self.env.ref('base.lu'):
                if journal['type'] == 'sale':
                    journal.update({
                       'default_debit_account_id': account.id,
                       'default_credit_account_id': account.id,
                       'refund_sequence': True
                    })
                elif journal['type'] == 'purchase':
                    journal.update({'refund_sequence': True})
        return journal_data
