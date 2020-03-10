# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class StockWarehouseOrderpoint(models.Model):
    _inherit = 'stock.warehouse.orderpoint'

    def _get_default_route_id(self):
        if self.product_id.bom_ids:
            route_id = self.env['stock.rule'].search([
                ('action', '=', 'manufacture')
            ]).route_id
            if route_id:
                return route_id[0]
        return super()._get_default_route_id()
