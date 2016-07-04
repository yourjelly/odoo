# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import datetime

from odoo import fields, models


class StockPickingType(models.Model):
    _inherit = 'stock.picking.type'

    code = fields.Selection(selection_add=[('mrp_operation', 'Manufacturing Operation')])
    count_mo_todo = fields.Integer(compute='_get_mo_count')
    count_mo_waiting = fields.Integer(compute='_get_mo_count')
    count_mo_late = fields.Integer(compute='_get_mo_count')

    def _get_mo_count(self):
        # TDE FIXME: use fields.Datetime
        MrpProduction = self.env['mrp.production']
        domains = {
            'count_mo_waiting': [('availability', '=', 'waiting')],
            'count_mo_todo': [('state', 'in', ('confirmed', 'planned', 'progress'))],
            'count_mo_late': ['&', ('date_planned_start', '<', datetime.now().strftime('%Y-%m-%d')), ('state', '=', 'confirmed')],
        }
        for picking in self.filtered(lambda pick: pick.code == 'mrp_operation'):
            for field in domains:
                data = MrpProduction.read_group(domains[field], ['picking_type_id'], ['picking_type_id'])
                count = dict(map(lambda x: (x['picking_type_id'] and x['picking_type_id'][0], x['picking_type_id_count']), data))
                picking[field] = count.get(picking.id, 0)
