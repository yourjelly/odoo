# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import UserError


class MergePickings(models.TransientModel):
    """
        Merge pickings together.
    """

    _name = 'stock.merge.pickings'
    _description = 'Merge Pickings'

    @api.model
    def default_get(self, fields):
        """ Use active_ids from the context to fetch the pickings to merge.
        """
        record_ids = self._context.get('active_ids')
        result = super(MergePickings, self).default_get(fields)

        if record_ids:
            if 'picking_ids' in fields:
                picking_ids = self.env['stock.picking'].browse(record_ids).ids
                result['picking_ids'] = picking_ids

        return result

    picking_ids = fields.Many2many('stock.picking', 'merge_picking_rel', 'merge_id', 'picking_id', string='Stock Picking')

    def _check_merge_conditions(self):
        error_msg = ""
        p_ids = self.picking_ids
        locations = p_ids.mapped('location_id')
        dest_locations = p_ids.mapped('location_dest_id')

        if len(p_ids) <= 1 or len(p_ids.mapped('move_lines')) < 1:
            error_msg = "Nothing to merge"

        elif len(p_ids.mapped('picking_type_id')) > 1:
            error_msg = "Operation type must be same to merge transfers."

        elif p_ids.filtered(lambda x: x.state in ('done', 'cancel')):
            error_msg = "Transfers can not be merged if state is 'Done' or 'Cancel'."

        elif len(locations) > 1 and not self._get_parent_loction(locations):
            error_msg = "Source location must be same to merge transfers."

        elif len(dest_locations) > 1 and not self._get_parent_loction(dest_locations):
            error_msg = "Destination location must be same to merge transfers."

        if error_msg:
            raise UserError(_(error_msg))

    def _get_parent_loction(self, locations):

        stock_location = self.env['stock.location']
        view_locations = stock_location.search([('usage', '=', 'view')])
        parent_location = False

        for location in locations:
            val = set([int(loc) for loc in location.parent_path.split('/') if loc != '' and int(loc) not in view_locations.ids])

            if not parent_location:
                parent_location = val
            else:
                parent_location = parent_location & val
                if len(parent_location) == 0:
                    return False

        return stock_location.browse(max(parent_location))

    @api.multi
    def action_merge(self):
        p_ids = self.picking_ids

        self._check_merge_conditions()

        location_id = self._get_parent_loction(p_ids.mapped('location_id'))
        location_dest_id = self._get_parent_loction(p_ids.mapped('location_dest_id'))

        move_type = p_ids.mapped('move_type')
        if len(move_type) > 1:
            move_type = 'one'

        move_lines = p_ids.mapped('move_lines').filtered(lambda x: x.state not in ('done', 'cancel'))
        move_lines.write({'location_id': location_id.id, 'location_dest_id': location_dest_id.id})

        vals = {
            'location_id': location_id.id,
            'location_dest_id': location_dest_id.id,
            'picking_type_id': p_ids.mapped('picking_type_id').id,
            'move_lines': [(4, m.id) for m in move_lines],
            'note': ('\n'.join(p.note for p in p_ids.filtered(lambda x: x.note))),
            'move_type': move_type,
        }

        new_picking = self.env['stock.picking'].create(vals)

        p_ids.mapped('move_line_ids').write({'picking_id': new_picking.id})
        p_ids.filtered(lambda x: not x.move_lines).unlink()

        return True
