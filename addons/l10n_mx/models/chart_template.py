# coding: utf-8
# Copyright 2016 Vauxoo (https://www.vauxoo.com) <info@vauxoo.com>
# License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).

from odoo import models, api, _


class AccountChartTemplate(models.Model):
    _inherit = 'account.chart.template'

    def _prepare_journals(self, company, loaded_data):
        # OVERRIDE
        journal_vals_list = super()._prepare_journals(company, loaded_data)
        if company.country_id.code == 'MX':
            accounts_mapping = loaded_data['account.account.template']['records']
            journal_vals_list.append({
                'type': 'general',
                'name': _('Effectively Paid'),
                'code': 'CBMX',
                'company_id': company.id,
                'default_account_id': accounts_mapping[self.env.ref('l10n_mx.cuenta118_01')].id,
                'show_on_dashboard': True,
            })
        return journal_vals_list

    def _update_company_after_loading(self, company, loaded_data):
        # OVERRIDE
        res = super()._update_company_after_loading(company, loaded_data)
        if company.country_id.code == 'MX':
            company.tax_cash_basis_journal_id = self.env['account.journal'].search([
                ('company_id', '=', company.id),
                ('type', '=', 'general'),
                ('code', '=', 'CBMX'),
            ], limit=1)
        return res

    @api.model
    def _prepare_payment_acquirer_account(self, company, **kwargs):
        # OVERRIDE
        if company.country_id.code == 'MX':
            kwargs.setdefault('tag_ids', [])
            kwargs['tag_ids'].append((4, self.env.ref('l10n_mx.account_tag_102_01').id))
        return super()._prepare_payment_acquirer_account(company, kwargs)
