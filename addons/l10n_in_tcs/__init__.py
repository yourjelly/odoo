from . import models

import logging

from odoo.exceptions import ValidationError

_logger = logging.getLogger(__name__)


def _l10n_in_tcs_post_init(env):
    """ Existing companies that have the Indian Chart of Accounts set """
    data = {
        model: env['account.chart.template']._parse_csv('in', model, module='l10n_in_tcs')
        for model in [
            'account.account',
            'account.tax',
        ]
    }
    for company in env['res.company'].search([('chart_template', '=', 'in'), ('parent_id', '=', False)]):
        _logger.info("Company %s already has the Indian localization installed, updating...", company.name)
        ChartTemplate = env['account.chart.template'].with_company(company)
        try:
            ChartTemplate._deref_account_tags('in', data['account.tax'])
            ChartTemplate._pre_reload_data(company, {}, data)
            ChartTemplate._load_data(data)
        except ValidationError as e:
            _logger.warning("Error while updating Chart of Accounts for company %s: %s", company.name, e.args[0])
