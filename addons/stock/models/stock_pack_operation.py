# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _

from odoo.addons import decimal_precision as dp
from odoo.exceptions import UserError
from odoo.tools.float_utils import float_round, float_compare, float_is_zero


class PackOperation(models.Model):
    _name = "stock.pack.operation" #TODO: change to stock.move.operation
    _description = "Packing Operation"
    _order = "result_package_id desc, id"

    picking_id = fields.Many2one(
        'stock.picking', 'Stock Picking',
        help='The stock operation where the packing has been made')
    move_id = fields.Many2one(
        'stock.move', 'Stock Move', 
        help="Change to a better name") 
    product_id = fields.Many2one('product.product', 'Product', ondelete="cascade") #might be a related with the move also --> no, because you can put them next to each other
    product_uom_id = fields.Many2one('product.uom', 'Unit of Measure')
    product_qty = fields.Float('Reserved', default=0.0, digits=dp.get_precision('Product Unit of Measure'), required=True)
    ordered_qty = fields.Float('Ordered Quantity', digits=dp.get_precision('Product Unit of Measure'))
    qty_done = fields.Float('Done', default=0.0, digits=dp.get_precision('Product Unit of Measure'), copy=False)
    package_id = fields.Many2one('stock.quant.package', 'Source Package')
    lot_id = fields.Many2one('stock.production.lot', 'Lot')
    lot_name = fields.Char('Lot/Serial Number')
    result_package_id = fields.Many2one(
        'stock.quant.package', 'Destination Package',
        ondelete='cascade', required=False,
        help="If set, the operations are packed into this package")
    date = fields.Datetime('Date', default=fields.Date.context_today, required=True)
    owner_id = fields.Many2one('res.partner', 'Owner', help="Owner of the quants")
    location_id = fields.Many2one('stock.location', 'From', required=True)
    location_dest_id = fields.Many2one('stock.location', 'To', required=True)
    picking_source_location_id = fields.Many2one('stock.location', related='picking_id.location_id')
    picking_destination_location_id = fields.Many2one('stock.location', related='picking_id.location_dest_id')
    # TDE FIXME: unnecessary fields IMO, to remove
    from_loc = fields.Char(compute='_compute_location_description')
    to_loc = fields.Char(compute='_compute_location_description')
    lots_visible = fields.Boolean(compute='_compute_lots_visible')
    state = fields.Selection(selection=[
        ('draft', 'Draft'),
        ('cancel', 'Cancelled'),
        ('waiting', 'Waiting Another Operation'),
        ('confirmed', 'Waiting Availability'),
        ('partially_available', 'Partially Available'),
        ('assigned', 'Available'),
        ('done', 'Done')], related='picking_id.state')

    @api.one
    def _compute_location_description(self):
        self.from_loc = '%s%s' % (self.location_id.name, self.product_id and self.package_id.name or '')
        self.to_loc = '%s%s' % (self.location_dest_id.name, self.result_package_id.name or '')

    @api.one
    @api.depends('picking_id.picking_type_id', 'product_id.tracking')
    def _compute_lots_visible(self):
        picking = self.picking_id
        if picking.picking_type_id and self.product_id.tracking != 'none':  # TDE FIXME: not sure correctly migrated
            self.lots_visible = picking.picking_type_id.use_existing_lots or picking.picking_type_id.use_create_lots
        else:
            self.lots_visible = self.product_id.tracking != 'none'

    @api.multi
    @api.onchange('product_id', 'product_uom_id')
    def onchange_product_id(self):
        if self.product_id:
            self.lots_visible = self.product_id.tracking != 'none'
            if not self.product_uom_id or self.product_uom_id.category_id != self.product_id.uom_id.category_id:
                self.product_uom_id = self.product_id.uom_id.id
            res = {'domain': {'product_uom_id': [('category_id', '=', self.product_uom_id.category_id.id)]}}
        else:
            res = {'domain': {'product_uom_id': []}}
        return res

    @api.model
    def create(self, vals):
        vals['ordered_qty'] = vals.get('product_qty')
        return super(PackOperation, self).create(vals)

    def _decrease_reserved_quantity(self, quantity):
        self.ensure_one()
        if self.location_id.should_impact_quants():
            self.env['stock.quant'].decrease_reserved_quantity(
                self.product_id,
                self.location_id,
                quantity,
                lot_id=self.lot_id,
                package_id=self.package_id,
                owner_id=self.owner_id,
            )

    @api.multi
    def write(self, vals):
        # We forbid to change the reserved quantity in the interace, but it is needed in the
        # case of stock.move's split.
        if 'product_qty' in vals and not self.env.context.get('dont_change_reservation'):
            for move_line in self.filtered(lambda ml: ml.state != 'done'):
                if self.state != 'draft':
                    self._decrease_reserved_quantity(move_line.product_qty - vals['product_qty'])

        # Through the interface, we allow users to change the source location, the lot, the package
        # and owner of a move line. If a quantity has been reserved for this move line, we try to
        # impact the reservation directly to free the old quants and allocate new ones.
        updates = {}
        for key, model in [('location_id', 'stock.location'), ('location_dest_id', 'stock.location'), ('lot_id', 'stock.production.lot'), ('package_id', 'stock.quant.package'), ('owner_id', 'res.partner')]:
            if key in vals:
                updates[key] = self.env[model].browse(vals[key])
        # note: qty done could change, but it only matters in state done?
        if updates:
            # FIXME: the state we have to look is the move's state, nit the picking's one. So the `state` field
            #        is probably useless and should be remove. take care that some packop could be added without
            #        move id in the details operations view, and they should not reserve and not come here
            for move_line in self.filtered(lambda ml: ml.move_id.state in ['partially_available', 'assigned']):
                if not move_line.location_id.should_impact_quants():
                    continue

                self._decrease_reserved_quantity(move_line.product_qty)
                # FIXME: we guard the reservation the same way in stock.move and the code looks
                #        crappy because of it, there must be a better way
                try:
                    quants = self.env['stock.quant'].increase_reserved_quantity(
                        move_line.product_id,
                        updates.get('location_id', move_line.location_id),
                        move_line.product_qty,
                        lot_id=updates.get('lot_id', move_line.lot_id),
                        package_id=updates.get('package_id', move_line.package_id),
                        owner_id=updates.get('owner_id', move_line.owner_id),
                        strict=True)
                    move_line.with_context(dont_change_reservation=True).product_qty = sum([q[1] for q in quants])
                except UserError:
                    if updates.get('lot_id', move_line.lot_id):
                        try:
                            quants = self.env['stock.quant'].increase_reserved_quantity(
                                move_line.product_id,
                                updates.get('location_id', move_line.location_id),
                                move_line.product_qty,
                                package_id=updates.get('package_id', move_line.package_id),
                                owner_id=updates.get('owner_id', move_line.owner_id),
                                strict=False)
                            move_line.with_context(dont_change_reservation=True).product_qty = sum([q[1] for q in quants])
                        except UserError:
                            move_line.with_context(dont_change_reservation=True).product_qty = 0
                    else:
                        move_line.with_context(dont_change_reservation=True).product_qty = 0

        if updates or 'qty_done' in vals:
            for move_line in self.filtered(lambda ml: ml.move_id.state == 'done'):
                # decrease the original in destination location
                if move_line.location_dest_id.should_impact_quants():
                    self.env['stock.quant'].decrease_available_quantity(move_line.product_id, move_line.location_dest_id,
                                                                        move_line.qty_done, lot_id=move_line.lot_id,
                                                                        package_id=move_line.package_id, owner_id=move_line.owner_id)
                # increase the original in source location
                if move_line.location_id.should_impact_quants():
                    self.env['stock.quant'].increase_available_quantity(move_line.product_id, move_line.location_id,
                                                                        move_line.qty_done, lot_id=move_line.lot_id,
                                                                        package_id=move_line.package_id, owner_id=move_line.owner_id)
                # decrease the update in source location
                # free potential move lines that aren't reserved anymore now that we took their product
                if updates.get('location_id', move_line.location_id).should_impact_quants():
                    move_line._free_reservation(
                        move_line.product_id,
                        updates.get('location_id', move_line.location_id),
                        vals.get('qty_done', move_line.qty_done),
                        lot_id=updates.get('lot_id', move_line.lot_id),
                        package_id=updates.get('package_id', move_line.package_id),
                        owner_id=updates.get('owner_id', move_line.owner_id)
                    )
                    self.env['stock.quant'].decrease_available_quantity(
                        move_line.product_id, updates.get('location_id', move_line.location_id), vals.get('qty_done', move_line.qty_done),
                        lot_id=updates.get('lot_id', move_line.lot_id), package_id=updates.get('package_id', move_line.package_id),
                        owner_id=updates.get('owner_id', move_line.owner_id)
                    )
                # increase the update in destination location
                quantity_to_increase = vals.get('qty_done', move_line.qty_done)
                if quantity_to_increase != 0:
                    if updates.get('location_dest_id', move_line.location_dest_id).should_impact_quants():
                        # if the new quantity is 0, do nothing
                            self.env['stock.quant'].increase_available_quantity(
                                move_line.product_id, updates.get('location_dest_id', move_line.location_dest_id), quantity_to_increase,
                                lot_id=updates.get('lot_id', move_line.lot_id), package_id=updates.get('package_id', move_line.package_id),
                                owner_id=updates.get('owner_id', move_line.owner_id)
                            )
        return super(PackOperation, self).write(vals)

    @api.multi
    def unlink(self):
        precision = self.env['decimal.precision'].precision_get('Product Unit of Measure')
        for move_line in self:
            if move_line.state in ('done', 'cancel'):
                raise UserError(_('You can not delete pack operations of a done picking'))
            # Unlinking a pack operation should unreserve.
            if not float_is_zero(move_line.product_qty, precision_digits=precision):
                move_line._decrease_reserved_quantity(move_line.product_qty)
        return super(PackOperation, self).unlink()

    def action_done(self):
        """ This method will finalize the work with a move line by "moving" quants to the
        destination location.
        """
        for move_line in self:
            if move_line.product_id.type != 'consu':
                rounding = move_line.product_uom_id.rounding

                # if this move line is force assigned, unreserve elsewhere if needed
                if float_compare(move_line.qty_done, move_line.product_qty, precision_rounding=rounding) > 0:
                    extra_qty = move_line.qty_done - move_line.product_qty
                    move_line._free_reservation(
                        move_line.product_id, move_line.location_id, extra_qty, lot_id=move_line.lot_id,
                        package_id=move_line.package_id, owner_id=move_line.owner_id
                    )
                # unreserve what's been reserved
                was_reserved_on_tracked_untracked_mix = False
                if move_line.location_id.should_impact_quants() and move_line.product_qty:
                    try:
                        self.env['stock.quant'].decrease_reserved_quantity(move_line.product_id, move_line.location_id, move_line.product_qty, lot_id=move_line.lot_id, package_id=move_line.package_id, owner_id=move_line.owner_id)
                    except UserError:
                        if move_line.lot_id:
                            self.env['stock.quant'].decrease_reserved_quantity(move_line.product_id, move_line.location_id, move_line.product_qty, package_id=move_line.package_id, owner_id=move_line.owner_id, strict=False)
                            was_reserved_on_tracked_untracked_mix = True
                        else:
                            raise
                # move what's been actually done
                quantity = move_line.move_id.product_uom._compute_quantity(move_line.qty_done, move_line.move_id.product_id.uom_id)
                if move_line.location_id.should_impact_quants():
                    if not was_reserved_on_tracked_untracked_mix:
                        self.env['stock.quant'].decrease_available_quantity(move_line.product_id, move_line.location_id, quantity, lot_id=move_line.lot_id, package_id=move_line.package_id, owner_id=move_line.owner_id)
                    else:
                        self.env['stock.quant'].decrease_available_quantity(move_line.product_id, move_line.location_id, quantity, package_id=move_line.package_id, owner_id=move_line.owner_id, strict=False)
                if move_line.location_dest_id.should_impact_quants():
                    self.env['stock.quant'].increase_available_quantity(move_line.product_id, move_line.location_dest_id, quantity, lot_id=move_line.lot_id, package_id=move_line.result_package_id, owner_id=move_line.owner_id)

    def _free_reservation(self, product_id, location_id, quantity, lot_id=None, package_id=None, owner_id=None):
        """ When editing a done move line or validating one with some forced quantities, it is
        possible to impact quants that were not reserved. It is therefore necessary to edit or
        unlink the move lines that reserved a quantity now unavailable.
        """
        self.ensure_one()

        # Check the available quantity, with the `strict` kw set to `True`. If the available
        # quantity is greather than the quantity now unavailable, there is nothing to do.
        available_quantity = self.env['stock.quant'].get_available_quantity(
            product_id, location_id, lot_id=lot_id, package_id=package_id, owner_id=owner_id, strict=True
        )
        if quantity > available_quantity:
            # We now have to find the move lines that reserved our now unavailable quantity. We
            # take care to exclude ourselves and the move lines were work had already been done.
            oudated_move_lines_domain = [
                ('move_id.state', 'not in', ['done', 'cancel']),
                ('product_id', '=', product_id.id),
                ('lot_id', '=', lot_id.id),
                ('location_id', '=', location_id.id),
                ('owner_id', '=', owner_id.id),
                ('package_id', '=', package_id.id),
                ('product_qty', '>', 0.0),
                ('qty_done', '=', 0.0),
                ('id', '!=', self.id),
            ]
            oudated_candidates = self.env['stock.pack.operation'].search(oudated_move_lines_domain)

            # As the move's state is not computed over the move lines, we'll have to manually
            # recompute the moves which we adapted their lines.
            move_to_recompute_state = self.env['stock.move']

            rounding = self.product_uom_id.rounding
            for candidate in oudated_candidates:
                if float_compare(candidate.product_qty, quantity, precision_rounding=rounding) <= 0:
                    quantity -= candidate.product_qty
                    move_to_recompute_state |= candidate.move_id
                    candidate.unlink()
                else:
                    # split this move line and assign the new part to our extra move
                    quantity_split = float_round(
                        candidate.product_qty - quantity,
                        precision_rounding=self.product_uom.rounding,
                        rounding_method='UP')
                    candidate.product_qty = quantity_split
                    quantity -= quantity_split
                    move_to_recompute_state |= candidate.move_id
                if quantity == 0.0:
                    break
            move_to_recompute_state._recompute_state()

    @api.multi
    def split_quantities(self):
        for operation in self:
            if float_compare(operation.product_qty, operation.qty_done, precision_rounding=operation.product_uom_id.rounding) == 1:
                cpy = operation.copy(default={'qty_done': 0.0, 'product_qty': operation.product_qty - operation.qty_done})
                operation.write({'product_qty': operation.qty_done})
                operation._copy_remaining_pack_lot_ids(cpy)
            else:
                raise UserError(_('The quantity to split should be smaller than the quantity To Do.  '))
        return True

    @api.multi
    def save(self):
        # TDE FIXME: does not seem to be used -> actually, it does
        # TDE FIXME: move me somewhere else, because the return indicated a wizard, in pack op, it is quite strange
        # HINT: 4. How to manage lots of identical products?
        # Create a picking and click on the Mark as TODO button to display the Lot Split icon. A window will pop-up. Click on Add an item and fill in the serial numbers and click on save button
        for pack in self:
            if pack.product_id.tracking != 'none':
                pack.write({'qty_done': sum(pack.pack_lot_ids.mapped('qty'))})
        return {'type': 'ir.actions.act_window_close'}

    @api.multi
    def show_details(self):
        # TDE FIXME: does not seem to be used
        view_id = self.env.ref('stock.view_pack_operation_details_form_save').id
        return {
            'name': _('Operation Details'),
            'type': 'ir.actions.act_window',
            'view_type': 'form',
            'view_mode': 'form',
            'res_model': 'stock.pack.operation',
            'views': [(view_id, 'form')],
            'view_id': view_id,
            'target': 'new',
            'res_id': self.ids[0],
            'context': self.env.context}