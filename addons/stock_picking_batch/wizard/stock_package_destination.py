# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class ChooseDestinationLocation(models.TransientModel):
    _inherit = "stock.package.destination"

    @api.depends('picking_id')
    def _compute_move_line_ids(self):
        for destination in self:
            if destination.picking_id.batch_id:
                destination.move_line_ids = destination.picking_id.batch_id.move_line_ids.filtered(lambda l: l.qty_done > 0 and not l.result_package_id)
            else:
                destination.move_line_ids = destination.picking_id.move_line_ids.filtered(lambda l: l.qty_done > 0 and not l.result_package_id)

    def action_done(self):
        if self.picking_id.batch_id:
            # set the same location on each move line and pass again in _put_in_pack
            for line in self.move_line_ids:
                line.location_dest_id = self.location_dest_id
            return self.picking_id.batch_id.put_in_pack()
        else:
            return super().action_done()
