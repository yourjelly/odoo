# -*- coding: utf-8 -*-

from odoo import api, fields, models, _


class AccountChartTemplate(models.Model):
    _inherit = 'account.chart.template'

    def _load_coa(self, company):
        # OVERRIDE
        res = super()._load_coa(company)
        self.env['payment.acquirer']._create_missing_journal_for_acquirers(company=company)
        return res
