# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class AccountPayment(models.Model):
    _inherit = "account.payment"

    def _get_counterpart_move_line_vals(self, invoice=False):
        res = super(AccountPayment, self)._get_counterpart_move_line_vals(invoice=False)
        default_analytic_account = self.env['account.analytic.default'].account_get(res['account_id'], self.partner_id.id, self._uid, fields.Date.today())
        res.update({
                    'analytic_account_id': default_analytic_account.analytic_id.id,
                })
        return res

    def _get_liquidity_move_line_vals(self, amount):
        res = super(AccountPayment, self)._get_liquidity_move_line_vals(amount)
        default_analytic_account = self.env['account.analytic.default'].account_get(res['account_id'], self.partner_id.id, self._uid, fields.Date.today())
        res.update({
                    'analytic_account_id': default_analytic_account.analytic_id.id,
                })
        return res
