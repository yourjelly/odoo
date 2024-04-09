# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import models
from odoo.addons.account.models.chart_template import template


class AccountChartTemplate(models.AbstractModel):
    _inherit = 'account.chart.template'

    @template('in', 'l10n_in.section.alert')
    def _get_l10n_in_section_alert(self):
        return self._parse_csv('in', 'l10n_in.section.alert', module='l10n_in_tds_tcs_warning')
