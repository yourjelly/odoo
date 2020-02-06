# -*- coding: utf-8 -*-

from odoo import models, fields, api


class AccountInvoiceReport(models.Model):
    _inherit = "account.invoice.report"

    analytic_account_id = fields.Many2one('account.analytic.account', string='Analytic Account', groups="analytic.group_analytic_accounting")

    _depends = {'account.move.line': ['analytic_account_id'], }

    @api.model
    def _select(self):
        return super(AccountInvoiceReport, self)._select() + ''',
                line.analytic_account_id'''

    @api.model
    def _group_by(self):
        return super(AccountInvoiceReport, self)._group_by() + ''',
                line.analytic_account_id'''
