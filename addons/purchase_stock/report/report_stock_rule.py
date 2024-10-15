# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models
from odoo.addons import stock


class ReportStockReport_Stock_Rule(stock.ReportStockReport_Stock_Rule):

    @api.model
    def _get_rule_loc(self, rule, product_id):
        """ We override this method to handle buy rules which do not have a location_src_id.
        """
        res = super()._get_rule_loc(rule, product_id)
        if rule.action == 'buy':
            res['source'] = self.env.ref('stock.stock_location_suppliers')
        return res
