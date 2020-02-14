# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, _


class StockWarehouse(models.Model):
    _inherit = 'stock.warehouse'

    def _get_global_route_rules_values(self):
        rules = super()._get_global_route_rules_values()
        for rule_many2one_field in ['manufacture_mto_pull_id', 'pbm_mto_pull_id']:
            mto_pull_rule_values = rules[rule_many2one_field].get('update_values').get('route_ids', False)
            if mto_pull_rule_values:
                rules[rule_many2one_field]['update_values']['route_ids'].append(
                    (4, self._find_global_route('purchase_stock.route_mto_buy', _('Buy + MTO')).id))
            else:
                rules[rule_many2one_field]['update_values']['route_ids'] = [
                    (4, self._find_global_route('purchase_stock.route_mto_buy', _('Buy + MTO')).id)
                ]
        return rules
