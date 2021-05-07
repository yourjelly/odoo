# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class ProfitabilityAnalysis(models.Model):
    _inherit = "project.profitability.report"

    expense_id = fields.Many2one('hr.expense', string='Expense', readonly=True)

    def _select_field_list(self):
        field_list = super()._select_field_list()
        field_list += [{'alias': 'expense_id', 'column': 'EXP.id'}]
        return field_list

    def _joins(self):
        joins = super()._joins()
        joins += """
                LEFT JOIN (
                                SELECT sub_EXP.id, sub_EXP.analytic_account_id, sub_EXP.sale_order_id, MAX(MY_SOL.id) AS sale_line_id
                                  FROM hr_expense sub_EXP
                            INNER JOIN sale_order_line MY_SOL ON sub_EXP.sale_order_id = MY_SOL.order_id
                                 WHERE MY_SOL.product_id = sub_EXP.product_id
                                   AND MY_SOL.is_expense = 't'
                                   AND MY_SOL.price_unit = sub_EXP.unit_amount
                                   AND MY_SOL.qty_delivered = sub_EXP.quantity
                              GROUP BY sub_EXP.id, sub_EXP.analytic_account_id, sub_EXP.sale_order_id
                            ) as EXP
                       ON EXP.analytic_account_id = %s.analytic_account_id
                      AND EXP.sale_order_id = %s.sale_order_id
                      AND EXP.sale_line_id = %s.sale_line_id
        """ % (self._main_table_alias(), self._main_table_alias(), self._main_table_alias())
        return joins
