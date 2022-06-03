# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models, _
from odoo.tools import format_date
from datetime import timedelta

class ReportBomStructure(models.AbstractModel):
    _inherit = 'report.mrp.report_bom_structure'

    @api.model
    def _format_route_info(self, rule, product, bom, quantity):
        res = super()._format_route_info(rule, product, bom, quantity)
        if self._is_buy_route(rule, product, bom):
            supplier = product._select_seller(quantity=quantity, uom_id=product.uom_id)
            if supplier:
                return {
                    'route_type': 'buy',
                    'route_name': rule.route_id.display_name,
                    'route_detail': supplier.display_name,
                    'lead_time': supplier.delay,
                    'supplier_delay': supplier.delay,
                    'supplier': supplier,
                }
        return res

    @api.model
    def _is_buy_route(self, rule, product, bom):
        return rule.action == 'buy' and product.seller_ids

    @api.model
    def _get_estimated_availability(self, date_today, route_data, children_lines):
        if route_data.get('route_type') == 'buy':
            current_delay = route_data.get('supplier_delay', 0)
            availability_date = date_today + timedelta(days=current_delay)
            return ('estimated', _('Estimated %s', format_date(self.env, availability_date)), availability_date, current_delay)
        return super()._get_estimated_availability(date_today, route_data, children_lines)
