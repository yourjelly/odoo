# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models


class AccountChartTemplate(models.Model):
    _inherit = 'account.chart.template'

    @api.model
    def _prepare_payment_acquirer_account(self, company, **kwargs):
        # OVERRIDE
        if company.country_id.code == 'DK':
            kwargs.setdefault('tag_ids', [])
            kwargs['tag_ids'].append((4, self.env.ref('l10n_dk.account_tag_liquidity').id))
            kwargs['name'] = "Bank i transfer"
        return super()._prepare_payment_acquirer_account(company, kwargs)
