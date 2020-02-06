# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    group_analytic_accounting = fields.Boolean(string='Analytic Accounting',
        implied_group='analytic.group_analytic_accounting')
    group_analytic_tags = fields.Boolean(string='Analytic Tags', implied_group='analytic.group_analytic_tags')
    module_account_budget = fields.Boolean(string='Budget Management')

    @api.onchange('group_analytic_accounting')
    def onchange_analytic_accounting(self):
        if self.group_analytic_accounting:
            self.module_account_accountant = True

    @api.onchange('module_account_budget')
    def onchange_module_account_budget(self):
        if self.module_account_budget:
            self.group_analytic_accounting = True