# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models, fields


class AccountChartTemplate(models.Model):
    _inherit = 'account.chart.template'

    def _prepare_journals(self, company, loaded_data):
        # OVERRIDE
        journal_vals_list = super()._prepare_journals(company, loaded_data)
        if company.country_id.code == 'LU':
            for journal_vals in journal_vals_list:
                if journal_vals['type'] in ('sale', 'purchase'):
                    journal_vals['refund_sequence'] = True
        return journal_vals_list
