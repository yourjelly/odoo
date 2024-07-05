# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, _
from odoo.tools import float_is_zero

class ReportMoOverview(models.AbstractModel):
    _inherit = 'report.mrp.report_mo_overview'

    def _get_unit_cost(self, move):
        valuation_layers = move.sudo().stock_valuation_layer_ids
        layers_quantity = sum(valuation_layers.mapped('quantity'))
        if valuation_layers and not float_is_zero(layers_quantity, precision_rounding=valuation_layers.uom_id.rounding):
            unit_price = sum(valuation_layers.mapped('value')) / layers_quantity
            return move.product_id.uom_id._compute_price(unit_price, move.product_uom)
        return super()._get_unit_cost(move)

    def _get_components_data(self, production, replenish_data=False, level=0, current_index=False):
        res = super()._get_components_data(production, replenish_data, level, current_index)
        if production.state != 'done':
            currency = (production.company_id or self.env.company).currency_id
            for index, wip_move in enumerate(production.move_wip_ids, len(res)):
                cost = currency.round(self._get_component_real_cost(wip_move, wip_move.quantity))
                res.append({
                    'replenishments': [],
                    'summary': {
                        'level': level,
                        'index': f'{index}',
                        'id': wip_move.product_id.id,
                        'model': wip_move.product_id._name,
                        'name': wip_move.product_id.display_name,
                        'product_model': wip_move.product_id._name,
                        'product_id': wip_move.product_id.id,
                        'product': wip_move.product_id,
                        'quantity': wip_move.quantity,
                        'uom': wip_move.product_uom,
                        'uom_name': wip_move.product_uom.display_name,
                        'uom_precision': self._get_uom_precision(wip_move.product_uom.rounding),
                        'unit_cost': self._get_unit_cost(wip_move),
                        'mo_cost': cost,
                        'real_cost': cost,
                        'currency_id': currency.id,
                        'currency': currency,
                        'state': 'wip',
                        'formatted_state': _('WIP')
                    }
                })
        return res
