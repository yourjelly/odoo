# -*- coding: utf-8 -*-

from odoo import models
from odoo.addons.account.models.chart_template import template


class AccountChartTemplate(models.AbstractModel):
    _inherit = "account.chart.template"

    @template('zm')
    def _get_zm_template_data(self):
        return {
            'code_digits': 7,
            'property_account_receivable_id': '8000000',
            'property_account_payable_id': '9000000',
            'property_account_expense_categ_id': '3000000',
            'property_account_income_categ_id': '1000000',
        }

    @template('zm', 'res.company')
    def _get_zm_res_company(self):
        return {
            self.env.company.id: {
                'anglo_saxon_accounting': True,
                'account_fiscal_country_id': 'base.zm',
                'bank_account_code_prefix': '8400000',
                'cash_account_code_prefix': '8400000',
                'transfer_account_code_prefix': '8400000',
                'account_default_pos_receivable_account_id': '8400000',
                'income_currency_exchange_account_id': '4210000',
                'expense_currency_exchange_account_id': '4210000',
                'account_journal_early_pay_discount_loss_account_id': '3550000',
                'account_journal_early_pay_discount_gain_account_id': '2700000',
                'account_sale_tax_id': 'zm_tax_sale_16',
                'account_purchase_tax_id': 'zm_tax_purchase_16',
                'deferred_expense_account_id': '8900000',
                'deferred_revenue_account_id': '9900000',
            }
        }
