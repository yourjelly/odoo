# coding: utf-8
# Copyright 2016 iterativo (https://www.iterativo.do) <info@iterativo.do>

from odoo import models, api, _


class AccountChartTemplate(models.Model):
    _inherit = 'account.chart.template'

    @api.model
    def _get_default_bank_journals_data(self):
        if self.env.company.country_id and self.env.company.country_id.code.upper() == 'DO':
            return [
                {'acc_name': _('Cash'), 'account_type': 'cash'},
                {'acc_name': _('Caja Chica'), 'account_type': 'cash'},
                {'acc_name': _('Cheques Clientes'), 'account_type': 'cash'},
                {'acc_name': _('Bank'), 'account_type': 'bank'}
            ]
        return super(AccountChartTemplate, self)._get_default_bank_journals_data()

    def _prepare_journals(self, company, loaded_data):
        # OVERRIDE
        journal_vals_list = super()._prepare_journals(company, loaded_data)
        if company.country_id.code == 'DO':
            for journal_vals in journal_vals_list:
                if journal_vals['code'] == 'FACT':
                    journal_vals['name'] = _('Compras Fiscales')
            journal_vals_list += [
                {
                    'type': 'purchase',
                    'name': _('Compras Informales'),
                    'code': 'CINF',
                    'company_id': company.id,
                    'show_on_dashboard': True
                },
                {
                    'type': 'purchase',
                    'name': _('Gastos Menores'),
                    'code': 'GASM',
                    'company_id': company.id,
                    'show_on_dashboard': True
                },
                {
                    'type': 'purchase',
                    'name': _('Compras al Exterior'),
                    'code': 'CEXT',
                    'company_id': company.id,
                    'show_on_dashboard': True
                },
                {
                    'type': 'purchase',
                    'name': _('Gastos No Deducibles'),
                    'code': 'GASTO',
                    'company_id': company.id,
                    'show_on_dashboard': True
                },
            ]
        return journal_vals_list
