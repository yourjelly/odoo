# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class AccountMoveLine(models.Model):
    _inherit = "account.move.line"

    @api.one
    def _prepare_analytic_line(self):
        res = super(AccountMoveLine, self)._prepare_analytic_line()
        [analytic_data] = res
        default_analytic_account = self.env['account.analytic.default'].account_get(analytic_data['account_id'], analytic_data['product_id'], analytic_data['partner_id'], analytic_data['user_id'], fields.Date.today())
        if default_analytic_account:
            analytic_data.update({'analytic_account_id': default_analytic_account.analytic_id.id})
        return analytic_data
