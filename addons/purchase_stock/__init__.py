# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from . import models
from . import report

from odoo import api, SUPERUSER_ID


def _create_buy_rules(cr, registry):
    """ This hook is used to add a default buy_pull_id on every warehouse. It is
    necessary if the purchase_stock module is installed after some warehouses
    were already created.
    """
    env = api.Environment(cr, SUPERUSER_ID, {})
    warehouse_ids = env['stock.warehouse'].search([('buy_pull_id', '=', False)])
    for warehouse_id in warehouse_ids:
        warehouse_id._create_or_update_global_routes_rules()
    warehouse_ids = env['stock.warehouse'].search([])
    location_ids = [
        w.delivery_steps == 'ship_only' and w.lot_stock_id.id or w.wh_output_stock_loc_id.id
        for w in warehouse_ids
    ]
    transit_location = warehouse_ids._get_transit_locations()
    rules = env['stock.rule'].search([
        ('location_src_id', 'in', location_ids),
        ('location_id', 'in', transit_location[0].ids + transit_location[1].ids),
        ('procure_method', 'in', ['make_to_order', 'mts_else_mto'])
    ])
    rules.write({'route_ids': [(4, env.ref('purchase_stock.route_buy_mto').id)]})
