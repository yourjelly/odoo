# -*- coding: utf-8 -*-
import logging

from odoo import models
import random
from functools import lru_cache


_logger = logging.getLogger(__name__)


class ResCompany(models.Model):
    _inherit = "res.company"

    def _populate(self, size):
        @lru_cache()
        def search_coa_ids(currency_id):
            return self.env['account.chart.template'].search([('currency_id', '=', currency_id)])

        records = super()._populate(size)
        _logger.info('Loading Chart Template')
        default_chart_templates = self.env['account.chart.template'].search([], limit=1)
        if not default_chart_templates:
            # TODO install l10n_generic_coa ?
            pass
        for company in records[:3]:
            chart_templates_cur = search_coa_ids(company.currency_id.id) or default_chart_templates
            random.choice(chart_templates_cur).with_company(company.id).try_loading()
        return records
