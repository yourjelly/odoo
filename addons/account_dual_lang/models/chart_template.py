# -*- coding: utf-8 -*-
from odoo import api, models, fields


class AccountChartTemplate(models.Model):
    _inherit = 'account.chart.template'

    base_lang = fields.Char('Base Language')
    dual_lang = fields.Char('Second Language')

    # Write paperformat and report template used on company
    def _load(self, sale_tax_rate, purchase_tax_rate, company):
        res = super(AccountChartTemplate, self)._load(sale_tax_rate, purchase_tax_rate, company)
        if self.base_lang and self.dual_lang:
            company.write({'base_lang': self.base_lang,
                           'dual_lang': self.dual_lang})
        return res