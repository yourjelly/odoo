# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models

class ProfitabilityAnalysis(models.Model):
    _inherit = "project.profitability.report"

    purchase_order_id = fields.Many2one('purchase.order', string='Purchase Order', readonly=True)
    bill_id = fields.Many2one('account.move.line', string='Vendor Bills', readonly=True)

    def _select_field_list(self):
        field_list = super()._select_field_list()
        field_list += [
            {'alias': 'purchase_order_id', 'column': 'PUR.id'},
        ]
        return field_list

    def _joins(self):
        joins = super()._joins()
        joins += """
                LEFT JOIN (
                                SELECT MAX(sub_PUR.id) as id, MY_SOL.id AS sale_line_id
                                  FROM purchase_order sub_PUR
                            INNER JOIN purchase_order_line PURL ON PURL.order_id = sub_PUR.id
                            INNER JOIN sale_order_line MY_SOL ON PURL.sale_line_id = MY_SOL.id
                              GROUP BY MY_SOL.id
                            ) as PUR
                       ON PUR.sale_line_id = %s.sale_line_id
        """ % (self._main_table_alias())
        return joins
