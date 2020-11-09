# -*- coding: utf-8 -*-
from odoo import api, models


class AccountChartTemplate(models.Model):
    _inherit = 'account.chart.template'

    @api.model
    def _prepare_payment_acquirer_account(self, company, **kwargs):
        # OVERRIDE
        if company.country_id.code == 'DE':
            kwargs.setdefault('tag_ids', [])
            kwargs['tag_ids'].append((4, self.env.ref('l10n_de.tag_de_asset_bs_B_III_2').id))
        return super()._prepare_payment_acquirer_account(company, kwargs)

    def _update_company_after_loading(self, company, loaded_data):
        # OVERRIDE
        # Write paperformat and report template used on company
        res = super()._update_company_after_loading(company, loaded_data)
        if company.country_id.code == 'DE':
            company.write({
                'external_report_layout_id': self.env.ref('l10n_de.external_layout_din5008').id,
                'paperformat_id': self.env.ref('l10n_de.paperformat_euro_din').id,
            })
        return res
