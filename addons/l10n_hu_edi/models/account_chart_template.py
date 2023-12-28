
from odoo import models


class AccountChartTemplate(models.Model):
    _inherit = 'account.chart.template'

    def _load(self, company):
        res = super()._load(company)
        if company.account_fiscal_country_id.code == 'HU':
            company._l10n_hu_edi_configure_company()
        return res
