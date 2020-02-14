# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from . import models

from odoo import api, SUPERUSER_ID


def _set_manufacture_mto_pull_rules_on_buy_route(cr, registry):
    env = api.Environment(cr, SUPERUSER_ID, {})
    warehouse_ids = env['stock.warehouse'].search([('manufacture_mto_pull_id', '!=', False)])
    for warehouse_id in warehouse_ids:
        warehouse_id._create_or_update_global_routes_rules()
