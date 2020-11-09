# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _


class AccountChartTemplate(models.Model):
    _inherit = 'account.chart.template'

    def _prepare_journals(self, company, loaded_data):
        # OVERRIDE
        journal_vals_list = super()._prepare_journals(company, loaded_data)
        if self == self.env.ref('l10n_in.indian_chart_template_standard'):
            for journal_vals in journal_vals_list:
                if journal_vals.get('type') in ('sale','purchase'):
                    journal_vals['l10n_in_gstin_partner_id'] = company.partner_id.id
                if journal_vals['code'] == 'INV':
                    journal_vals['name'] = _('Tax Invoices')
        return journal_vals_list


class AccountTaxTemplate(models.Model):
    _inherit = 'account.tax.template'

    l10n_in_reverse_charge = fields.Boolean("Reverse charge", help="Tick this if this tax is reverse charge. Only for Indian accounting")
