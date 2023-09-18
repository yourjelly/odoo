# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, Command


class AccountChartTemplate(models.AbstractModel):
    _inherit = 'account.chart.template'

    def _load(self, template_code, company, install_demo):
        result = super()._load(template_code, company, install_demo)
        if template_code.startswith('es'):
            product_21 = self.env.ref('l10n_es.product_dua_valuation_21')
            default_tax_21 = self.env.ref('account.' + str(company.id) + '_account_tax_template_p_iva0_ibc_group')
            product_21.with_context(allowed_company_ids=company.ids).supplier_taxes_id = [Command.set(default_tax_21.ids)]

        return result
