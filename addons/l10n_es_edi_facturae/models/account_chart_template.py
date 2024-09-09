from odoo import models
from odoo.addons.account.models.chart_template import template


class AccountChartTemplate(models.AbstractModel):
    _inherit = 'account.chart.template'

    @template('es_common', 'account.tax')
    def _get_es_factuae_account_tax(self):
        return self._parse_csv('es_common', 'account.tax', module='l10n_es_edi_facturae')

    def _post_load_data(self, template_code, company, template_data):
        if template_code.startswith('es_'):
            self._load_data({
                'account.tax': self._get_es_factuae_account_tax(),
            })
        super()._post_load_data(template_code, company, template_data)
