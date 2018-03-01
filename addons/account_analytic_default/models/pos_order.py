# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class PosOrder(models.Model):
    _inherit = "pos.order"

    def _prepare_analytic_account(self, line):
        for l in self:
            default_analytic_account = self.env['account.analytic.default'].account_get(self.sale_journal.default_debit_account_id.id, line.product_id.id, l.partner_id.id, l.user_id.id, fields.Date.today())
        return default_analytic_account.analytic_id.id
