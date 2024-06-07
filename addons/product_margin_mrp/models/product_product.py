import time
from odoo import models


class ProductProduct(models.Model):
    _inherit = "product.product"

    def _compute_product_margin_fields_values(self):
        date_from = self.env.context.get('date_from', time.strftime('%Y-01-01'))
        date_to = self.env.context.get('date_to', time.strftime('%Y-12-31'))
        invoice_state = self.env.context.get('invoice_state', 'open_paid')
        res = {
            product_id: {'date_from': date_from, 'date_to': date_to, 'invoice_state': invoice_state, 'turnover': 0.0,
                'sale_avg_price': 0.0, 'purchase_avg_price': 0.0, 'sale_num_invoiced': 0.0, 'purchase_num_invoiced': 0.0,
                'sales_gap': 0.0, 'purchase_gap': 0.0, 'total_cost': 0.0, 'sale_expected': 0.0, 'normal_cost': 0.0, 'total_margin': 0.0,
                'expected_margin': 0.0, 'total_margin_rate': 0.0, 'expected_margin_rate': 0.0}
            for product_id in self.ids
        }

        company_id = self.env.context.get("force_company", self.env.company.id)
        sql_qry = """
                    SELECT
                        product_id,
                        ABS(SUM(CASE WHEN quantity > 0 THEN quantity ELSE 0 END)) AS positive_quantity,
                        ABS(SUM(CASE WHEN quantity < 0 THEN quantity ELSE 0 END)) AS negative_quantity,
                        ABS(SUM(CASE WHEN value > 0 THEN value ELSE 0 END)) AS positive_value,
                        ABS(SUM(CASE WHEN value < 0 THEN value ELSE 0 END)) AS negative_value
                    FROM stock_valuation_layer
                    WHERE product_id IN %s
                    AND create_date BETWEEN %s AND %s
                    AND company_id = %s
                    GROUP BY product_id """

        self.env.cr.execute(sql_qry, (tuple(self.ids), date_from, date_to, company_id))
        result = self.env.cr.fetchall()
        for product_id, p_qty, n_qty, p_value, n_value in result:
            # negative values
            if n_qty != 0:
                res[product_id]['sale_avg_price'] = n_value / n_qty or 0
            else:
                res[product_id]['sale_avg_price'] = 0
            res[product_id]['sale_num_invoiced'] = n_qty and n_qty or 0.0
            res[product_id]['turnover'] = n_value and n_value or 0.0
            res[product_id]['total_margin'] = res[product_id]['turnover']
            res[product_id]['total_margin_rate'] = res[product_id]['turnover'] and res[product_id]['total_margin'] * 100 / res[product_id]['turnover'] or 0.0

            #  positive values
            if p_qty != 0:
                res[product_id]['purchase_avg_price'] = p_value / p_qty or 0
            else:
                res[product_id]['purchase_avg_price'] = 0
            res[product_id]['purchase_num_invoiced'] = p_qty and p_qty or 0.0
            res[product_id]['total_cost'] = p_value and p_value or 0.0
            res[product_id]['total_margin'] = res[product_id].get('turnover', 0.0) - res[product_id]['total_cost']
            res[product_id]['total_margin_rate'] = res[product_id].get('turnover', 0.0) and res[product_id]['total_margin'] * 100 / res[product_id].get('turnover', 0.0) or 0.0

        for product in self:
            product.update(res[product.id])
        return res
