# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from collections import defaultdict

from odoo import api, fields, models, _
from odoo.exceptions import UserError
from odoo.tools.float_utils import float_round, float_compare, float_is_zero


class ReturnPickingLine(models.TransientModel):
    _name = "stock.return.picking.line"
    _rec_name = 'product_id'
    _description = 'Return Picking Line'

    product_id = fields.Many2one('product.product', string="Product", required=True, domain="[('id', '=', product_id)]")
    quantity = fields.Float("Quantity", digits='Product Unit of Measure', required=True)
    returnable_qty = fields.Float("Quantity previously returned", digits='Product Unit of Measure')
    uom_id = fields.Many2one('uom.uom', string='Unit of Measure', related='move_id.product_uom', readonly=False)
    wizard_id = fields.Many2one('stock.return.picking', string="Wizard", copy=False)
    move_id = fields.Many2one('stock.move', "Move")
    lot_id = lot_id = fields.Many2one('stock.production.lot', string='Lot/Serial Number', help="Lot/Serial number concerned by the ticket", domain="[('product_id', '=', product_id)]")

    @api.onchange('quantity')
    def _onchange_quantity(self):

        if float_compare(self.quantity, self.returnable_qty, precision_rounding=self.uom_id.rounding) == 1:
            return {'warning': {
                'message': _('The quantity you entered  for the product %(product)s is greater than the quantity still available for return') % {'product': self.product_id.name}
            }}

class ReturnPicking(models.TransientModel):
    _name = 'stock.return.picking'
    _description = 'Return Picking'

    @api.model
    def default_get(self, fields):
        if len(self.env.context.get('active_ids', list())) > 1:
            raise UserError(_("You may only return one picking at a time."))
        res = super(ReturnPicking, self).default_get(fields)
        if self.env.context.get('active_id') and self.env.context.get('active_model') == 'stock.picking':
            picking = self.env['stock.picking'].browse(self.env.context.get('active_id'))
            if picking.exists():
                res.update({'picking_id': picking.id})
        return res

    picking_id = fields.Many2one('stock.picking')
    product_return_moves = fields.One2many('stock.return.picking.line', 'wizard_id', 'Moves')
    move_dest_exists = fields.Boolean('Chained Move Exists', readonly=True)
    original_location_id = fields.Many2one('stock.location')
    parent_location_id = fields.Many2one('stock.location')
    company_id = fields.Many2one(related='picking_id.company_id')
    location_id = fields.Many2one(
        'stock.location', 'Return Location',
        domain="['|', ('id', '=', original_location_id), '|', '&', ('return_location', '=', True), ('company_id', '=', False), '&', ('return_location', '=', True), ('company_id', '=', company_id)]")

    @api.onchange('picking_id')
    def _onchange_picking_id(self):
        if self.picking_id and self.picking_id.state != 'done':
            raise UserError(_("You may only return Done pickings."))

        moves = self.picking_id.move_lines.filtered(lambda m: not m.scrapped)
        move_dest_exists = any(m.move_dest_ids for m in moves)
        return_values = self._generate_return_lines(moves)
        product_return_moves = self.env['stock.return.picking.line'].create(return_values)

        if self.picking_id and not product_return_moves:
            raise UserError(_("No products to return (only lines in Done state and not fully returned yet can be returned)."))
        if self.picking_id:
            self.product_return_moves = product_return_moves
            self.move_dest_exists = move_dest_exists
            self.parent_location_id = self.picking_id.picking_type_id.warehouse_id and self.picking_id.picking_type_id.warehouse_id.view_location_id.id or self.picking_id.location_id.location_id.id
            self.original_location_id = self.picking_id.location_id.id
            location_id = self.picking_id.location_id.id
            if self.picking_id.picking_type_id.return_picking_type_id.default_location_dest_id.return_location:
                location_id = self.picking_id.picking_type_id.return_picking_type_id.default_location_dest_id.id
            self.location_id = location_id

    @api.model
    def _prepare_stock_return_picking_line_vals_from_move(self, stock_move):
        outgoing_qties = stock_move.move_dest_ids.filtered(lambda m: m.state in ['partially_available', 'assigned', 'done']).mapped('move_line_ids.product_qty')
        returned_qties = stock_move.returned_move_ids.filtered(lambda m: m.state not in ['draft', 'cancel']).mapped('move_line_ids.qty_done')
        quantity = stock_move.product_qty - sum(outgoing_qties + returned_qties)
        quantity = float_round(quantity, precision_rounding=stock_move.product_uom.rounding)
        return {
            'product_id': stock_move.product_id.id,
            'quantity': quantity,
            'returnable_qty': quantity,
            'move_id': stock_move.id,
            'uom_id': stock_move.product_id.uom_id.id,
        }

    def _generate_return_lines(self, moves):
        return_values = []
        initial_moves = moves
        all_moves = initial_moves
        while moves.mapped('returned_move_ids'):
            all_moves |= moves.mapped('returned_move_ids')
            moves = moves.mapped('returned_move_ids')
        
        # Keep only done moves
        done_moves = all_moves.filtered(lambda m: m.state == 'done')

        # Filter Incoming/Outgoing moves
        moves_in = done_moves.filtered(lambda m: m.location_dest_id == self.picking_id.location_dest_id)
        moves_out = done_moves - moves_in

        # Get tracked move lines
        lot_sml_in = moves_in.mapped('move_line_ids').filtered(lambda m: bool(m.lot_id) != False)
        lot_sml_out = moves_out.mapped('move_line_ids').filtered(lambda m: bool(m.lot_id) != False)

        # Get untracked moves
        untracked_sml_in = (moves_in - lot_sml_in.mapped('move_id')).mapped('move_line_ids')
        untracked_sml_out = (moves_out - lot_sml_out.mapped('move_id')).mapped('move_line_ids')

        # Get returnable quantities per SN/LN 
        qties_per_lot = defaultdict(lambda: 0)
        for ml in lot_sml_out:
            qties_per_lot[ml.lot_id] -= ml.product_uom_id._compute_quantity(ml.qty_done, ml.product_id.uom_id)
        for ml in lot_sml_in:
            qties_per_lot[ml.lot_id] += ml.product_uom_id._compute_quantity(ml.qty_done, ml.product_id.uom_id)

        
        for lot_id, qty in qties_per_lot.items():
            if float_is_zero(qty, precision_rounding=lot_id.product_id.uom_id.rounding):
                continue
            return_values.append({
                'product_id': lot_id.product_id.id,
                'quantity': qty,
                'returnable_qty': qty,
                'lot_id': lot_id.id,
                'move_id': self.picking_id.move_line_ids.filtered(lambda ml : ml.lot_id == lot_id).move_id.id,
                'uom_id': lot_id.product_id.uom_id.id,
            })

        # Get returnable quantities for untracked product
        qties_per_product = defaultdict(lambda: 0)
        for ml in untracked_sml_out:
            qties_per_product[ml.product_id] -= ml.product_uom_id._compute_quantity(ml.qty_done, ml.product_id.uom_id)
        for ml in untracked_sml_in:
            qties_per_product[ml.product_id] += ml.product_uom_id._compute_quantity(ml.qty_done, ml.product_id.uom_id)

        for product_id, qty in qties_per_product.items():
            if float_is_zero(qty, precision_rounding=product_id.uom_id.rounding):
                continue
            return_values.append({
                'product_id': product_id.id,
                'quantity': qty,
                'returnable_qty': qty,
                'lot_id': False,
                'move_id': self.picking_id.move_line_ids.filtered(lambda ml : ml.id in untracked_sml_in.ids and ml.product_id == product_id).move_id.id,
                'uom_id': product_id.uom_id.id,
            })
        
        return return_values

    def _generate_move_line_values(self, picking):
            sml_vals = []
            processed_rl = self.env['stock.return.picking.line']
            for move in picking.move_lines:
                unprocessed_rl = self.product_return_moves - processed_rl
                for return_line in unprocessed_rl:
                    if return_line.move_id == move.origin_returned_move_id:
                        sml_vals.append({
                            'picking_id': picking.id,
                            'move_id': move.id,
                            'product_id': move.product_id.id,
                            'product_uom_id': move.product_uom.id,
                            'location_id': move.location_id.id,
                            'location_dest_id': move.location_dest_id.id,
                            'lot_id': return_line.lot_id.id,
                            'qty_done': return_line.quantity
                        })
                        processed_rl |= return_line
            return sml_vals

    def _get_summarized_rl(self):
        srl_per_move = {}
        for return_line in self.product_return_moves:
            if return_line.move_id in srl_per_move:
                srl_per_move[return_line.move_id].quantity += return_line.quantity
            elif not return_line.move_id:
                raise UserError(_("You have manually created product lines, please delete them to proceed."))
            else:
                srl_per_move[return_line.move_id] = return_line.copy()
        return srl_per_move

    def _prepare_move_default_values(self, return_line, new_picking):
        vals = {
            'product_id': return_line.product_id.id,
            'product_uom_qty': return_line.quantity,
            'product_uom': return_line.product_id.uom_id.id,
            'picking_id': new_picking.id,
            'state': 'draft',
            'date_expected': fields.Datetime.now(),
            'location_id': return_line.move_id.location_dest_id.id,
            'location_dest_id': self.location_id.id or return_line.move_id.location_id.id,
            'picking_type_id': new_picking.picking_type_id.id,
            'warehouse_id': self.picking_id.picking_type_id.warehouse_id.id,
            'origin_returned_move_id': return_line.move_id.id,
            'procure_method': 'make_to_stock',
        }
        return vals

    def _create_returns(self):
        # TODO sle: the unreserve of the next moves could be less brutal
        for return_move in self.product_return_moves.mapped('move_id'):
            return_move.move_dest_ids.filtered(lambda m: m.state not in ('done', 'cancel'))._do_unreserve()

        # create new picking for returned products
        picking_type_id = self.picking_id.picking_type_id.return_picking_type_id.id or self.picking_id.picking_type_id.id
        new_picking = self.picking_id.copy({
            'move_lines': [],
            'picking_type_id': picking_type_id,
            'state': 'draft',
            'origin': _("Return of %s") % self.picking_id.name,
            'location_id': self.picking_id.location_dest_id.id,
            'location_dest_id': self.location_id.id})
        new_picking.message_post_with_view('mail.message_origin_link',
            values={'self': new_picking, 'origin': self.picking_id},
            subtype_id=self.env.ref('mail.mt_note').id)
        returned_lines = 0

        for move, return_line in self._get_summarized_rl().items():
            # TODO sle: float_is_zero?
            if return_line.quantity:
                returned_lines += 1
                vals = self._prepare_move_default_values(return_line, new_picking)
                r = return_line.move_id.copy(vals)
                vals = {}

                # +--------------------------------------------------------------------------------------------------------+
                # |       picking_pick     <--Move Orig--    picking_pack     --Move Dest-->   picking_ship
                # |              | returned_move_ids              ↑                                  | returned_move_ids
                # |              ↓                                | return_line.move_id              ↓
                # |       return pick(Add as dest)          return toLink                    return ship(Add as orig)
                # +--------------------------------------------------------------------------------------------------------+
                move_orig_to_link = return_line.move_id.move_dest_ids.mapped('returned_move_ids')
                move_dest_to_link = return_line.move_id.move_orig_ids.mapped('returned_move_ids')
                vals['move_orig_ids'] = [(4, m.id) for m in move_orig_to_link | return_line.move_id]
                vals['move_dest_ids'] = [(4, m.id) for m in move_dest_to_link]
                r.write(vals)
        if not returned_lines:
            raise UserError(_("Please specify at least one non-zero quantity."))

        sml_vals = self._generate_move_line_values(new_picking)
        self.env['stock.move.line'].create(sml_vals)
        new_picking.action_confirm()
        new_picking.action_assign()
        return new_picking.id, picking_type_id

    def create_returns(self):
        for wizard in self:
            new_picking_id, pick_type_id = wizard._create_returns()
        # Override the context to disable all the potential filters that could have been set previously
        ctx = dict(self.env.context)
        ctx.update({
            'search_default_picking_type_id': pick_type_id,
            'search_default_draft': False,
            'search_default_assigned': False,
            'search_default_confirmed': False,
            'search_default_ready': False,
            'search_default_late': False,
            'search_default_available': False,
        })
        return {
            'name': _('Returned Picking'),
            'view_mode': 'form,tree,calendar',
            'res_model': 'stock.picking',
            'res_id': new_picking_id,
            'type': 'ir.actions.act_window',
            'context': ctx,
        }
