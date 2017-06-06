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
    package_id = fields.Many2one('stock.quant.package', 'Source Package', ondelete='restrict')
    lot_id = fields.Many2one('stock.production.lot', 'Lot')
    lot_name = fields.Char('Lot/Serial Number')
    result_package_id = fields.Many2one(
        'stock.quant.package', 'Destination Package',
        ondelete='restrict', required=False,
        help="If set, the operations are packed into this package")
    date = fields.Datetime('Date', default=fields.Datetime.now(), required=True)
    owner_id = fields.Many2one('res.partner', 'Owner', help="Owner of the quants")
    location_id = fields.Many2one('stock.location', 'From', required=True)
    location_dest_id = fields.Many2one('stock.location', 'To', required=True)
    picking_source_location_id = fields.Many2one('stock.location', related='picking_id.location_id')
    picking_destination_location_id = fields.Many2one('stock.location', related='picking_id.location_dest_id')
    # TDE FIXME: unnecessary fields IMO, to remove
    from_loc = fields.Char(compute='_compute_location_description')
    to_loc = fields.Char(compute='_compute_location_description')
    lots_visible = fields.Boolean(compute='_compute_lots_visible')
    state = fields.Selection(related='move_id.state')

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
        ml = super(PackOperation, self).create(vals)
        if ml.state == 'done':
            Quant = self.env['stock.quant']
            quantity = ml.move_id.product_uom._compute_quantity(ml.qty_done, ml.move_id.product_id.uom_id)
            if ml.location_id.should_impact_quants():
                available_qty = Quant._decrease_available_quantity(ml.product_id, ml.location_id, quantity, lot_id=ml.lot_id, package_id=ml.package_id, owner_id=ml.owner_id)
                if available_qty < 0 and ml.lot_id:
                    # see if we can compensate the negative quants with some untracked quants
                    untracked_qty = Quant._get_available_quantity(ml.product_id, ml.location_id, lot_id=False, package_id=ml.package_id, owner_id=ml.owner_id, strict=True)
                    if untracked_qty:
                        taken_from_untracked_qty = min(untracked_qty, abs(quantity))
                        Quant._decrease_available_quantity(ml.product_id, ml.location_id, taken_from_untracked_qty, lot_id=False, package_id=ml.package_id, owner_id=ml.owner_id)
                        Quant._increase_available_quantity(ml.product_id, ml.location_id, taken_from_untracked_qty, lot_id=ml.lot_id, package_id=ml.package_id, owner_id=ml.owner_id)
            if ml.location_dest_id.should_impact_quants():
                Quant._increase_available_quantity(ml.product_id, ml.location_dest_id, quantity, lot_id=ml.lot_id, package_id=ml.result_package_id, owner_id=ml.owner_id)
        return ml

    @api.multi
    def write(self, vals):
        """ Through the interface, we allow users to change the charateristics of a move line. If a
        quantity has been reserved for this move line, we impact the reservation directly to free
        the old quants and allocate the new ones.
        """
        if self.env.context.get('bypass_reservation_update'):
            return super(PackOperation, self).write(vals)

        Quant = self.env['stock.quant']
        # We forbid to change the reserved quantity in the interace, but it is needed in the
        # case of stock.move's split.
        if 'product_qty' in vals and not self.env.context.get('bypass_reservation_update'):
            for ml in self.filtered(lambda m: m.state in ('partially_available', 'assigned')):
                if ml.location_id.should_impact_quants():
                    qty_to_decrease = ml.product_qty - vals['product_qty']
                    try:
                        Quant._decrease_reserved_quantity(ml.product_id, ml.location_id, qty_to_decrease, lot_id=ml.lot_id, package_id=ml.package_id, owner_id=ml.owner_id)
                    except UserError:
                        if ml.lot_id:
                            Quant._decrease_reserved_quantity(ml.product_id, ml.location_id, qty_to_decrease, lot_id=False, package_id=ml.package_id, owner_id=ml.owner_id)
                        else:
                            raise

        triggers = [
            ('location_id', 'stock.location'),
            ('location_dest_id', 'stock.location'),
            ('lot_id', 'stock.production.lot'),
            ('package_id', 'stock.quant.package'),
            ('result_package_id', 'stock.quant.package'),
            ('owner_id', 'res.partner')
        ]
        updates = {}
        for key, model in triggers:
            if key in vals:
                updates[key] = self.env[model].browse(vals[key])

        if updates:
            for ml in self.filtered(lambda ml: ml.state in ['partially_available', 'assigned']):
                if ml.location_id.should_impact_quants():
                    try:
                        Quant._decrease_reserved_quantity(ml.product_id, ml.location_id, ml.product_qty, lot_id=ml.lot_id, package_id=ml.package_id, owner_id=ml.owner_id)
                    except UserError:
                        if ml.lot_id:
                            Quant._decrease_reserved_quantity(ml.product_id, ml.location_id, ml.product_qty, lot_id=False, package_id=ml.package_id, owner_id=ml.owner_id)
                        else:
                            raise

                if updates.get('location_id', ml.location_id).should_impact_quants():
                    new_product_qty = 0
                    try:
                        q = Quant._increase_reserved_quantity(ml.product_id, updates.get('location_id', ml.location_id), ml.product_qty, lot_id=updates.get('lot_id', ml.lot_id),
                                                             package_id=updates.get('package_id', ml.package_id), owner_id=updates.get('owner_id', ml.owner_id), strict=True)
                        new_product_qty = sum([x[1] for x in q])
                    except UserError:
                        if updates.get('lot_id'):
                            # If we were not able to reserve on tracked quants, we can use untracked ones.
                            try:
                                q = Quant._increase_reserved_quantity(ml.product_id, updates.get('location_id', ml.location_id), ml.product_qty, lot_id=False,
                                                                     package_id=updates.get('package_id', ml.package_id), owner_id=updates.get('owner_id', ml.owner_id), strict=True)
                                new_product_qty = sum([x[1] for x in q])
                            except UserError:
                                pass
                    if new_product_qty != ml.product_qty:
                        ml.with_context(bypass_reservation_update=True).product_qty = new_product_qty

        if updates or 'qty_done' in vals:
            for ml in self.filtered(lambda ml: ml.move_id.state == 'done'):
                # undo the original move line
                if ml.location_dest_id.should_impact_quants():
                    Quant._decrease_available_quantity(ml.product_id, ml.location_dest_id, ml.qty_done, lot_id=ml.lot_id,
                                                      package_id=ml.package_id, owner_id=ml.owner_id)
                if ml.location_id.should_impact_quants():
                    Quant._increase_available_quantity(ml.product_id, ml.location_id, ml.qty_done, lot_id=ml.lot_id,
                                                      package_id=ml.package_id, owner_id=ml.owner_id)

                # move what's been actually done
                product_id = ml.product_id
                location_id = updates.get('location_id', ml.location_id)
                location_dest_id = updates.get('location_dest_id', ml.location_dest_id)
                qty_done = vals.get('qty_done', ml.qty_done)
                lot_id = updates.get('lot_id', ml.lot_id)
                package_id = updates.get('package_id', ml.package_id)
                result_package_id = updates.get('result_package_id', ml.result_package_id)
                owner_id = updates.get('owner_id', ml.owner_id)
                quantity = ml.move_id.product_uom._compute_quantity(qty_done, ml.move_id.product_id.uom_id)
                if location_id.should_impact_quants():
                    ml._free_reservation(product_id, location_id, quantity, lot_id=lot_id, package_id=package_id, owner_id=owner_id)
                    available_qty = Quant._decrease_available_quantity(product_id, location_id, quantity, lot_id=lot_id, package_id=package_id, owner_id=owner_id)
                    if available_qty < 0 and lot_id:
                        # see if we can compensate the negative quants with some untracked quants
                        untracked_qty = Quant._get_available_quantity(product_id, location_id, lot_id=False, package_id=package_id, owner_id=owner_id, strict=True)
                        if untracked_qty:
                            taken_from_untracked_qty = min(untracked_qty, abs(available_qty))
                            Quant._decrease_available_quantity(product_id, location_id, taken_from_untracked_qty, lot_id=False, package_id=package_id, owner_id=owner_id)
                            Quant._increase_available_quantity(product_id, location_id, taken_from_untracked_qty, lot_id=lot_id, package_id=package_id, owner_id=owner_id)
                            ml._free_reservation(ml.product_id, location_id, untracked_qty, lot_id=False, package_id=package_id, owner_id=owner_id)
                if location_dest_id.should_impact_quants() and qty_done:
                    Quant._increase_available_quantity(product_id, location_dest_id, quantity, lot_id=lot_id, package_id=result_package_id, owner_id=owner_id)
        return super(PackOperation, self).write(vals)

    @api.multi
    def unlink(self):
        precision = self.env['decimal.precision'].precision_get('Product Unit of Measure')
        for ml in self:
            if ml.state in ('done', 'cancel'):
                raise UserError(_('You can not delete pack operations of a done picking'))
            # Unlinking a pack operation should unreserve.
            if ml.location_id.should_impact_quants() and not float_is_zero(ml.product_qty, precision_digits=precision):
                self.env['stock.quant']._decrease_reserved_quantity(ml.product_id, ml.location_id, ml.product_qty, lot_id=ml.lot_id,
                                                                   package_id=ml.package_id, owner_id=ml.owner_id)
        return super(PackOperation, self).unlink()

    def action_done(self):
        """ This method will finalize the work with a move line by "moving" quants to the
        destination location.
        """
        for ml in self:
            if ml.product_id.type != 'consu':
                Quant = self.env['stock.quant']
                rounding = ml.product_uom_id.rounding

                # if this move line is force assigned, unreserve elsewhere if needed
                if float_compare(ml.qty_done, ml.product_qty, precision_rounding=rounding) > 0:
                    extra_qty = ml.qty_done - ml.product_qty
                    ml._free_reservation(ml.product_id, ml.location_id, extra_qty, lot_id=ml.lot_id, package_id=ml.package_id, owner_id=ml.owner_id)
                # unreserve what's been reserved
                if ml.location_id.should_impact_quants() and ml.product_qty:
                    try:
                        Quant._decrease_reserved_quantity(ml.product_id, ml.location_id, ml.product_qty, lot_id=ml.lot_id, package_id=ml.package_id, owner_id=ml.owner_id)
                    except UserError:
                        Quant._decrease_reserved_quantity(ml.product_id, ml.location_id, ml.product_qty, lot_id=False, package_id=ml.package_id, owner_id=ml.owner_id)

                # move what's been actually done
                quantity = ml.move_id.product_uom._compute_quantity(ml.qty_done, ml.move_id.product_id.uom_id)
                if ml.location_id.should_impact_quants():
                    available_qty = Quant._decrease_available_quantity(ml.product_id, ml.location_id, quantity, lot_id=ml.lot_id, package_id=ml.package_id, owner_id=ml.owner_id)
                    if available_qty < 0 and ml.lot_id:
                        # see if we can compensate the negative quants with some untracked quants
                        untracked_qty = Quant._get_available_quantity(ml.product_id, ml.location_id, lot_id=False, package_id=ml.package_id, owner_id=ml.owner_id, strict=True)
                        if untracked_qty:
                            taken_from_untracked_qty = min(untracked_qty, abs(quantity))
                            Quant._decrease_available_quantity(ml.product_id, ml.location_id, taken_from_untracked_qty, lot_id=False, package_id=ml.package_id, owner_id=ml.owner_id)
                            Quant._increase_available_quantity(ml.product_id, ml.location_id, taken_from_untracked_qty, lot_id=ml.lot_id, package_id=ml.package_id, owner_id=ml.owner_id)
                if ml.location_dest_id.should_impact_quants():
                    Quant._increase_available_quantity(ml.product_id, ml.location_dest_id, quantity, lot_id=ml.lot_id, package_id=ml.result_package_id, owner_id=ml.owner_id)

    def _free_reservation(self, product_id, location_id, quantity, lot_id=None, package_id=None, owner_id=None):
        """ When editing a done move line or validating one with some forced quantities, it is
        possible to impact quants that were not reserved. It is therefore necessary to edit or
        unlink the move lines that reserved a quantity now unavailable.
        """
        self.ensure_one()

        # Check the available quantity, with the `strict` kw set to `True`. If the available
        # quantity is greather than the quantity now unavailable, there is nothing to do.
        available_quantity = self.env['stock.quant']._get_available_quantity(
            product_id, location_id, lot_id=lot_id, package_id=package_id, owner_id=owner_id, strict=True
        )
        if quantity > available_quantity:
            # We now have to find the move lines that reserved our now unavailable quantity. We
            # take care to exclude ourselves and the move lines were work had already been done.
            oudated_move_lines_domain = [
                ('move_id.state', 'not in', ['done', 'cancel']),
                ('product_id', '=', product_id.id),
                ('lot_id', '=', lot_id.id if lot_id else False),
                ('location_id', '=', location_id.id),
                ('owner_id', '=', owner_id.id if owner_id else False),
                ('package_id', '=', package_id.id if package_id else False),
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
                        precision_rounding=self.product_uom_id.rounding,
                        rounding_method='UP')
                    candidate.product_qty = quantity_split
                    quantity -= quantity_split
                    move_to_recompute_state |= candidate.move_id
                if quantity == 0.0:
                    break
            move_to_recompute_state._recompute_state()
