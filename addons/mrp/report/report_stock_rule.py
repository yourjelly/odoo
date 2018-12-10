# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from datetime import timedelta

from odoo import api, models


class ReportStockRule(models.AbstractModel):
    _inherit = 'report.stock.report_stock_rule'

    def _calculate_lead_date(self, route, product, lead_date, estimate_date):
        if route['rule'].action == 'manufacture':
            if product.produce_delay:
                lead_date = lead_date + timedelta(days=-product.produce_delay)
            return lead_date
        return super(ReportStockRule, self)._calculate_lead_date(route, product, lead_date, estimate_date)

    @api.model
    def _get_rule_loc(self, rule, product_id):
        """ We override this method to handle manufacture rule which do not have a location_src_id.
        """
        res = super(ReportStockRule, self)._get_rule_loc(rule, product_id)
        if rule.action == 'manufacture':
            res['source'] = product_id.property_stock_production
        return res
