# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api


class PurchaseOrder(models.Model):
    _inherit = 'purchase.order'

    subcontracting_delivery_picking_count = fields.Integer(
        "Count of Subcontracting Deliveries", compute='_compute_subcontracting_delivery_picking_count',
        help="Count of Subcontracting Deliveries for component to resupply")

    @api.depends('order_line.move_ids')
    def _compute_subcontracting_delivery_picking_count(self):
        for purchase in self:
            purchase.subcontracting_delivery_picking_count = len(purchase._get_subcontracting_deliveries())

    def action_view_subcontracting_delivery(self):
        return self._get_action_view_picking(self._get_subcontracting_deliveries())

    def _get_subcontracting_deliveries(self):
        moves_subcontracted = self.order_line.move_ids.filtered(lambda m: m.is_subcontract)
        subcontracted_productions = moves_subcontracted.move_orig_ids.production_id
        return subcontracted_productions.picking_ids
