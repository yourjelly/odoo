# -*- coding: utf-8 -*-

from odoo import api, fields, models, _

import logging


class AccountTaxTemplate(models.Model):
    _inherit = 'account.tax.template'

    analytic = fields.Boolean(string="Analytic Cost", help="If set, the amount computed by this tax will be assigned to the same analytic account as the invoice line (if any)")

    def _get_tax_vals(self, company, tax_template_to_tax):
        val = super(AccountTaxTemplate, self)._get_tax_vals(company, tax_template_to_tax)
        val['analytic'] = self.analytic
        return val
