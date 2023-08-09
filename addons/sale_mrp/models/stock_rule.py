# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class StockRule(models.Model):
    _inherit = 'stock.rule'

    def _merge_mo_domain(self, procurement, bom, group, rule):
        if procurement.values.get('mrp_sale_line_id'):
            return [('sale_line_id', '=', procurement.values['mrp_sale_line_id'].id)]
        return super()._merge_mo_domain(procurement, bom, group, rule)

    def _prepare_mo_vals(self, product_id, product_qty, product_uom, location_dest_id, name, origin, company_id, values, bom):
        vals = super()._prepare_mo_vals(product_id, product_qty, product_uom, location_dest_id, name, origin, company_id, values, bom)
        if values.get('mrp_sale_line_id'):
            vals['sale_line_id'] = values.get('mrp_sale_line_id').id
        return vals

    def _get_custom_move_fields(self):
        fields = super(StockRule, self)._get_custom_move_fields()
        fields += ['mrp_sale_line_id']
        return fields
