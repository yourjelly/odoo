# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, exceptions, fields, models, _
from odoo.exceptions import UserError
from odoo.tools import float_compare, float_round
from odoo.addons import decimal_precision as dp


class StockPackOperation(models.Model):
    _inherit = 'stock.pack.operation'

    workorder_id = fields.Many2one('mrp.workorder', 'Work Order')
    production_id = fields.Many2one('mrp.production', 'Production Order')
    lot_produced_id = fields.Many2one('stock.production.lot', 'Finished Lot')
    lot_produced_qty = fields.Float('Quantity Finished Product', help="Informative, not used in matching")
    done_wo = fields.Boolean('Done for Work Order', default=True, help="Technical Field which is False when temporarily filled in in work order")  # TDE FIXME: naming
    done_move = fields.Boolean('Move Done', related='move_id.is_done', store=True)  # TDE FIXME: naming
    consume_line_ids = fields.Many2many('stock.pack.operation', 'stock_pack_operation_consume_rel', 'consume_line_id', 'produce_line_id', help="Technical link to see who consumed what. ")
    produce_line_ids = fields.Many2many('stock.pack.operation', 'stock_pack_operation_consume_rel', 'produce_line_id', 'consume_line_id', help="Technical link to see which line was produced with this. ")

    @api.one
    @api.constrains('lot_id', 'qty_done')
    def _check_lot_id(self):
        if self.move_id.product_id.tracking == 'serial':
            lots = set([])
            for move_lot in self.move_id.active_move_line_ids.filtered(lambda r: not r.lot_produced_id and r.lot_id):
                if move_lot.lot_id in lots:
                    raise exceptions.UserError(_('You cannot use the same serial number in two different lines.'))
                if float_compare(move_lot.qty_done, 1.0, precision_rounding=move_lot.move_id.product_id.uom_id.rounding) == 1:
                    raise exceptions.UserError(_('You can only produce 1.0 %s for products with unique serial number.') % move_lot.product_id.uom_id.name)
                lots.add(move_lot.lot_id)

    @api.multi
    def write(self, vals):
        if 'lot_id' in vals:
            for movelot in self:
                movelot.move_id.production_id.move_raw_ids.mapped('pack_operation_ids')\
                    .filtered(lambda r: r.done_wo and not r.done_move and r.lot_produced_id == movelot.lot_id)\
                    .write({'lot_produced_id': vals['lot_id']})
        return super(StockPackOperation, self).write(vals)


class StockMove(models.Model):
    _inherit = 'stock.move'

    production_id = fields.Many2one(
        'mrp.production', 'Production Order for finished products')
    raw_material_production_id = fields.Many2one(
        'mrp.production', 'Production Order for raw materials')
    unbuild_id = fields.Many2one(
        'mrp.unbuild', 'Unbuild Order')
    consume_unbuild_id = fields.Many2one(
        'mrp.unbuild', 'Consume Unbuild Order')
    operation_id = fields.Many2one(
        'mrp.routing.workcenter', 'Operation To Consume')  # TDE FIXME: naming
    workorder_id = fields.Many2one(
        'mrp.workorder', 'Work Order To Consume')
    # Quantities to process, in normalized UoMs
    active_move_line_ids = fields.One2many('stock.pack.operation', 'move_id', domain=[('done_wo', '=', True)], string='Lots')
    bom_line_id = fields.Many2one('mrp.bom.line', 'BoM Line')
    unit_factor = fields.Float('Unit Factor')
    is_done = fields.Boolean(
        'Done', compute='_compute_is_done',
        store=True,
        help='Technical Field to order moves')
    quantity_done = fields.Float('Quantity Done', compute='_quantity_done_compute', digits=dp.get_precision('Product Unit of Measure'), inverse='_quantity_done_set',
                                 states={'done': [('readonly', True)]})
    show_split_visible = fields.Boolean('Show split visible', compute='_compute_split_visible')

    def _compute_split_visible(self):
        """
            Similar logic as for pickings, but applied to manufacturing orders
        """
        for move in self:
            if not move.product_id:
                move.show_split_visible = False
                continue

            if move.is_editable:
                move.show_split_visible = True
                continue

            multi_locations_enabled = False
            if self.user_has_groups('stock.group_stock_multi_locations'):
                multi_locations_enabled = move.location_id.child_ids or move.location_dest_id.child_ids
            has_package = move.pack_operation_ids.mapped('package_id') | move.pack_operation_ids.mapped('result_package_id')
            if move.state not in ['cancel', 'draft', 'confirmed']\
                    and (multi_locations_enabled or move.has_tracking != 'none' or len(move.pack_operation_ids) > 1 or has_package):
                move.show_split_visible = True
            else:
                move.show_split_visible = False

    @api.multi
    @api.depends('pack_operation_ids.qty_done')
    def _quantity_done_compute(self):
        for move in self:
            move.quantity_done = sum(move.active_move_line_ids.mapped('qty_done'))

    @api.multi
    def _quantity_done_set(self):
        for move in self:
            if move.quantity_done:
                if not move.active_move_line_ids:
                    # do not impact reservation here
                    move_line = self.env['stock.pack.operation'].create(dict(self._prepare_move_line_vals(), qty_done=move.quantity_done))
                    move.write({'pack_operation_ids': [(4, move_line.id)]})
                elif len(move.active_move_line_ids) == 1:
                    move.active_move_line_ids[0].qty_done = move.quantity_done
                else:
                    raise UserError("blabla")

    @api.multi
    @api.depends('state')
    def _compute_is_done(self):
        for move in self:
            move.is_done = (move.state in ('done', 'cancel'))

    @api.multi
    def action_assign(self):
        res = super(StockMove, self).action_assign()
        for move in self.filtered(lambda x: x.production_id or x.raw_material_production_id):
            if move.pack_operation_ids:
                move.pack_operation_ids.write({'production_id': move.raw_material_production_id.id, 
                                               'workorder_id': move.workorder_id.id,})
        return res

    @api.multi
    def action_cancel(self):
        if any(move.quantity_done for move in self): #TODO: either put in stock, or check there is a production order related to it
            raise exceptions.UserError(_('You cannot cancel a stock move having already consumed material'))
        return super(StockMove, self).action_cancel()

    @api.multi
    # Could use split_move_operation from stock here
    def split_move_line(self):
        self.ensure_one()

        view = self.env.ref('mrp.view_stock_move_lots')
        return {
            'name': _('Detailed Operations'),
            'type': 'ir.actions.act_window',
            'view_type': 'form',
            'view_mode': 'form',
            'res_model': 'stock.move',
            'views': [(view.id, 'form')],
            'view_id': view.id,
            'target': 'new',
            'res_id': self.id,
            'context': dict(
                self.env.context,
                show_lots_m2o=self.has_tracking != 'none',# and (self.picking_type_id.use_existing_lots or self.state == 'done'),  # able to create lots, whatever the value of ` use_create_lots`.
                show_lots_text=False,#self.has_tracking != 'none' and self.picking_type_id.use_create_lots and not self.picking_type_id.use_existing_lots and self.state != 'done',
show_source_location=False if self.production_id else self.location_id.child_ids,
                show_destination_location=False if self.raw_material_production_id else self.location_dest_id.child_ids,
                show_package=not self.location_id.usage == 'production', #not used for the moment
            ),
        }

    @api.multi
    def save(self):
        return True

    @api.multi
    def action_confirm(self):
        moves = self.env['stock.move']
        for move in self:
            moves |= move.action_explode()
        # we go further with the list of ids potentially changed by action_explode
        return super(StockMove, moves).action_confirm()

    def action_explode(self):
        """ Explodes pickings """
        # in order to explode a move, we must have a picking_type_id on that move because otherwise the move
        # won't be assigned to a picking and it would be weird to explode a move into several if they aren't
        # all grouped in the same picking.
        if not self.picking_type_id:
            return self
        bom = self.env['mrp.bom'].sudo()._bom_find(product=self.product_id)
        if not bom or bom.type != 'phantom':
            return self
        phantom_moves = self.env['stock.move']
        processed_moves = self.env['stock.move']
        factor = self.product_uom._compute_quantity(self.product_uom_qty, bom.product_uom_id) / bom.product_qty
        boms, lines = bom.sudo().explode(self.product_id, factor, picking_type=bom.picking_type_id)
        for bom_line, line_data in lines:
            phantom_moves += self._generate_move_phantom(bom_line, line_data['qty'])

        for new_move in phantom_moves:
            processed_moves |= new_move.action_explode()
#         if not self.split_from and self.procurement_id:
#             # Check if procurements have been made to wait for
#             moves = self.procurement_id.move_ids
#             if len(moves) == 1:
#                 self.procurement_id.write({'state': 'done'})
        if processed_moves and self.state == 'assigned':
            # Set the state of resulting moves according to 'assigned' as the original move is assigned
            processed_moves.write({'state': 'assigned'})
        # delete the move with original product which is not relevant anymore
        self.sudo().unlink()
        return processed_moves

    def _generate_move_phantom(self, bom_line, quantity):
        if bom_line.product_id.type in ['product', 'consu']:
            return self.copy(default={
                'picking_id': self.picking_id.id if self.picking_id else False,
                'product_id': bom_line.product_id.id,
                'product_uom': bom_line.product_uom_id.id,
                'product_uom_qty': quantity,
                'state': 'draft',  # will be confirmed below
                'name': self.name,
                'procurement_id': self.procurement_id.id,
                'split_from': self.id,  # Needed in order to keep sale connection, but will be removed by unlink
            })
        return self.env['stock.move']

class PushedFlow(models.Model):
    _inherit = "stock.location.path"

    def _prepare_move_copy_values(self, move_to_copy, new_date):
        new_move_vals = super(PushedFlow, self)._prepare_move_copy_values(move_to_copy, new_date)
        new_move_vals['production_id'] = False

        return new_move_vals
