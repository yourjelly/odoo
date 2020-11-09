# -*- coding: utf-8 -*-

from odoo import api, fields, models, _


class AccountChartTemplate(models.Model):
    _inherit = 'account.chart.template'

    def _install_coa(self, company):
        # OVERRIDE
        # Add tag to 999999 account
        res = super()._install_coa(company)
        if company.country_id.code == 'NL':
            account = self.env['account.account'].search([('code', '=', '999999'), ('company_id', '=', company.id)])
            if account:
                account.tag_ids = [(4, self.env.ref('l10n_nl.account_tag_12').id)]
        return res

    @api.model
    def _prepare_payment_acquirer_account(self, company, **kwargs):
        # OVERRIDE
        if company.country_id.code == 'NL':
            kwargs.setdefault('tag_ids', [])
            kwargs['tag_ids'].append((4, self.env.ref('l10n_nl.account_tag_25').id))
        return super()._prepare_payment_acquirer_account(company, kwargs)
