# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models, fields


class ReturnPicking(models.TransientModel):
    _inherit = 'stock.return.picking'

    subcontract_location_id = fields.Many2one('stock.location', compute='_compute_picking_dependancies')

    def _compute_picking_dependancies(self):
        super()._compute_picking_dependancies()
        for r in self:
            r.subcontract_location_id = r.picking_id.partner_id.with_company(
                r.picking_id.company_id
            ).property_stock_subcontractor
            if any(return_line.quantity > 0 and return_line.move_id.is_subcontract for return_line in r.product_return_moves):
                r.location_id = r.picking_id.partner_id.with_company(r.picking_id.company_id).property_stock_subcontractor

    def _prepare_move_default_values(self, return_line, new_picking):
        vals = super(ReturnPicking, self)._prepare_move_default_values(return_line, new_picking)
        vals['is_subcontract'] = False
        return vals
