# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class AccountMoveLine(models.Model):
    _inherit = "account.move.line"

    @api.model
    def create(self, vals):
        vals = super(AccountMoveLine, self).create(vals)
        default_analytic_account = self.env['account.analytic.default'].account_get(vals['account_id'].id, vals['product_id'].id, vals['partner_id'].id, self._uid, fields.Date.today())
        if default_analytic_account:
            vals.update({'analytic_account_id': default_analytic_account.analytic_id.id})
        return vals
