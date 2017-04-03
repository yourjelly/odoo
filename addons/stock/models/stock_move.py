# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import datetime
from dateutil import relativedelta
import time

from odoo import api, fields, models, _
from odoo.addons import decimal_precision as dp
from odoo.addons.procurement.models import procurement
from odoo.exceptions import UserError
from odoo.tools import DEFAULT_SERVER_DATETIME_FORMAT
from odoo.tools.float_utils import float_compare, float_round, float_is_zero

class StockMove(models.Model):
    _name = "stock.move"
    _description = "Stock Move"
    _order = 'picking_id, sequence, id'

    def _default_group_id(self):
        if self.env.context.get('default_picking_id'):
            return self.env['stock.picking'].browse(self.env.context['default_picking_id']).group_id.id
        return False

    name = fields.Char('Description', index=True, required=True)
    sequence = fields.Integer('Sequence', default=10)
    priority = fields.Selection(procurement.PROCUREMENT_PRIORITIES, 'Priority', default='1')
    create_date = fields.Datetime('Creation Date', index=True, readonly=True)
    date = fields.Datetime(
        'Date', default=fields.Datetime.now, index=True, required=True,
        states={'done': [('readonly', True)]},
        help="Move date: scheduled date until move is done, then date of actual move processing")
    company_id = fields.Many2one(
        'res.company', 'Company',
        default=lambda self: self.env['res.company']._company_default_get('stock.move'),
        index=True, required=True)
    date_expected = fields.Datetime(
        'Expected Date', default=fields.Datetime.now, index=True, required=True,
        states={'done': [('readonly', True)]},
        help="Scheduled date for the processing of this move")
    product_id = fields.Many2one(
        'product.product', 'Product',
        domain=[('type', 'in', ['product', 'consu'])], index=True, required=True,
        states={'done': [('readonly', True)]})
    ordered_qty = fields.Float('Ordered Quantity', digits=dp.get_precision('Product Unit of Measure'))
    product_qty = fields.Float(
        'Real Quantity', compute='_compute_product_qty', inverse='_set_product_qty',
        digits=0, store=True,
        help='Quantity in the default UoM of the product')
    product_uom_qty = fields.Float(
        'Quantity',
        digits=dp.get_precision('Product Unit of Measure'),
        default=1.0, required=True, states={'done': [('readonly', True)]},
        help="This is the quantity of products from an inventory "
             "point of view. For moves in the state 'done', this is the "
             "quantity of products that were actually moved. For other "
             "moves, this is the quantity of product that is planned to "
             "be moved. Lowering this quantity does not generate a "
             "backorder. Changing this quantity on assigned moves affects "
             "the product reservation, and should be done with care.")
    product_uom = fields.Many2one(
        'product.uom', 'Unit of Measure', required=True, states={'done': [('readonly', True)]})
    # TDE FIXME: make it stored, otherwise group will not work
    product_tmpl_id = fields.Many2one(
        'product.template', 'Product Template',
        related='product_id.product_tmpl_id',
        help="Technical: used in views")
    product_packaging = fields.Many2one(
        'product.packaging', 'Preferred Packaging',
        help="It specifies attributes of packaging like type, quantity of packaging,etc.")
    location_id = fields.Many2one(
        'stock.location', 'Source Location',
        auto_join=True, index=True, required=True, states={'done': [('readonly', True)]},
        help="Sets a location if you produce at a fixed location. This can be a partner location if you subcontract the manufacturing operations.")
    location_dest_id = fields.Many2one(
        'stock.location', 'Destination Location',
        auto_join=True, index=True, required=True, states={'done': [('readonly', True)]},
        help="Location where the system will stock the finished products.")
    partner_id = fields.Many2one(
        'res.partner', 'Destination Address ',
        states={'done': [('readonly', True)]},
        help="Optional address where goods are to be delivered, specifically used for allotment")
    move_dest_ids = fields.Many2many(
        'stock.move', 'stock_move_move_rel', 'move_orig_id', 'move_dest_id', 'Destination Moves',
        copy=False, index=True,
        help="Optional: next stock move when chaining them")
    move_orig_ids = fields.Many2many(
        'stock.move', 'stock_move_move_rel', 'move_dest_id', 'move_orig_id', 'Original Move',
        help="Optional: previous stock move when chaining them")
    picking_id = fields.Many2one('stock.picking', 'Transfer Reference', index=True, states={'done': [('readonly', True)]})
    picking_partner_id = fields.Many2one('res.partner', 'Transfer Destination Address', related='picking_id.partner_id')
    note = fields.Text('Notes')
    state = fields.Selection([
        ('draft', 'New'), ('cancel', 'Cancelled'),
        ('waiting', 'Waiting Another Move'), ('confirmed', 'Waiting Availability'),
        ('assigned', 'Available'), ('done', 'Done')], string='Status',
        copy=False, default='draft', index=True, readonly=True,
        help="* New: When the stock move is created and not yet confirmed.\n"
             "* Waiting Another Move: This state can be seen when a move is waiting for another one, for example in a chained flow.\n"
             "* Waiting Availability: This state is reached when the procurement resolution is not straight forward. It may need the scheduler to run, a component to be manufactured...\n"
             "* Available: When products are reserved, it is set to \'Available\'.\n"
             "* Done: When the shipment is processed, the state is \'Done\'.")
    partially_available = fields.Boolean('Partially Available', copy=False, readonly=True, help="Checks if the move has some stock reserved")
    price_unit = fields.Float(
        'Unit Price', help="Technical field used to record the product cost set by the user during a picking confirmation (when costing "
                           "method used is 'average price' or 'real'). Value given in company currency and in product uom.")  # as it's a technical field, we intentionally don't provide the digits attribute
    backorder_id = fields.Many2one('stock.picking', 'Back Order of', related='picking_id.backorder_id', index=True)
    origin = fields.Char("Source Document")
    procure_method = fields.Selection([
        ('make_to_stock', 'Default: Take From Stock'),
        ('make_to_order', 'Advanced: Apply Procurement Rules')], string='Supply Method',
        default='make_to_stock', required=True,
        help="By default, the system will take from the stock in the source location and passively wait for availability."
             "The other possibility allows you to directly create a procurement on the source location (and thus ignore "
             "its current stock) to gather products. If we want to chain moves and have this one to wait for the previous,"
             "this second option should be chosen.")
    scrapped = fields.Boolean('Scrapped', related='location_dest_id.scrap_location', readonly=True, store=True)
    quant_ids = fields.Many2many('stock.quant', 'stock_quant_move_rel', 'move_id', 'quant_id', 'Moved Quants', copy=False)
    reserved_quant_ids = fields.One2many('stock.quant', 'reservation_id', 'Reserved quants')
    operation_ids = fields.One2many('stock.pack.operation', 'move_id', 'Operations')
    procurement_ids = fields.Many2many('procurement.order', 'stock_move_procurement_rel', 'move_id', 'procurement_id', 'Procurements')
    group_id = fields.Many2one('procurement.group', 'Procurement Group', default=_default_group_id)
    rule_id = fields.Many2one('procurement.rule', 'Procurement Rule', ondelete='restrict', help='The procurement rule that created this stock move')
    push_rule_id = fields.Many2one('stock.location.path', 'Push Rule', ondelete='restrict', help='The push rule that created this stock move')
    propagate = fields.Boolean(
        'Propagate cancel and split', default=True,
        help='If checked, when this move is cancelled, cancel the linked move too')
    picking_type_id = fields.Many2one('stock.picking.type', 'Operation Type')
    inventory_id = fields.Many2one('stock.inventory', 'Inventory')
    lot_ids = fields.Many2many('stock.production.lot', string='Lots/Serial Numbers', compute='_compute_lot_ids')
    pack_operation_ids = fields.One2many('stock.pack.operation', 'move_id')
    origin_returned_move_id = fields.Many2one('stock.move', 'Origin return move', copy=False, help='Move that created the return move')
    returned_move_ids = fields.One2many('stock.move', 'origin_returned_move_id', 'All returned moves', help='Optional: all returned moves created from this move')
    reserved_availability = fields.Float(
        'Quantity Reserved', compute='_compute_reserved_availability',
        readonly=True, help='Quantity that has already been reserved for this move')
    availability = fields.Float(
        'Forecasted Quantity', compute='_compute_product_availability',
        readonly=True, help='Quantity in stock that can still be reserved for this move')
    string_availability_info = fields.Text(
        'Availability', compute='_compute_string_qty_information',
        readonly=True, help='Show various information on stock availability for this move')
    restrict_lot_id = fields.Many2one('stock.production.lot', 'Lot/Serial Number', help="Technical field used to depict a restriction on the lot/serial number of quants to consider when marking this move as 'done'")
    restrict_partner_id = fields.Many2one('res.partner', 'Owner ', help="Technical field used to depict a restriction on the ownership of quants to consider when marking this move as 'done'")
    route_ids = fields.Many2many('stock.location.route', 'stock_location_route_move', 'move_id', 'route_id', 'Destination route', help="Preferred route to be followed by the procurement order")
    warehouse_id = fields.Many2one('stock.warehouse', 'Warehouse', help="Technical field depicting the warehouse to consider for the route selection on the next procurement (if any).")
    has_tracking = fields.Selection(related='product_id.tracking', string='Product with Tracking')
    quantity_done_store = fields.Float('Quantity', digits=0)
    quantity_done = fields.Float(
        'Quantity', compute='_qty_done_compute', inverse='_qty_done_set',
        digits=dp.get_precision('Product Unit of Measure'))
    detail_visible = fields.Boolean('Details Visible', compute='_compute_detail_visible')

    @api.multi
    @api.depends('product_id', 'pack_operation_ids', 'picking_id.location_id', 'picking_id.location_dest_id')
    def _compute_detail_visible(self):
        locations = self.mapped('location_id') | self.mapped('location_dest_id')
        locations_children = self.env['stock.location'].search([('id', 'child_of', locations.ids), ('id', 'not in', locations.ids)]) 
        if locations_children:
            for move in self:
                move.detail_visible = True
        else:
            for move in self:
                if move.has_tracking != 'none' or len(move.pack_operation_ids.ids) > 1:
                    move.detail_visible = True
                else:
                    move.detail_visible = False

    @api.one
    @api.depends('product_id', 'product_uom', 'product_uom_qty')
    def _compute_product_qty(self):
        if self.product_uom:
            self.product_qty = self.product_uom._compute_quantity(self.product_uom_qty, self.product_id.uom_id)

    def _set_product_qty(self):
        """ The meaning of product_qty field changed lately and is now a functional field computing the quantity
        in the default product UoM. This code has been added to raise an error if a write is made given a value
        for `product_qty`, where the same write should set the `product_uom_qty` field instead, in order to
        detect errors. """
        raise UserError(_('The requested operation cannot be processed because of a programming error setting the `product_qty` field instead of the `product_uom_qty`.'))

    @api.multi
    @api.depends('pack_operation_ids.qty_done', 'quantity_done_store')
    def _qty_done_compute(self):
        for move in self:
            #if move.has_tracking != 'none':
            move.quantity_done = sum(move.pack_operation_ids.mapped('qty_done'))
            #else:
            #    move.quantity_done = move.quantity_done_store

    @api.multi
    def _qty_done_set(self):
        for move in self:
            if move.has_tracking == 'none':
                move.quantity_done_store = move.quantity_done

    @api.one
    @api.depends('state', 'quant_ids.lot_id', 'reserved_quant_ids.lot_id')
    def _compute_lot_ids(self):
        if self.state == 'done':
            self.lot_ids = self.mapped('quant_ids').mapped('lot_id').ids
        else:
            self.lot_ids = self.mapped('reserved_quant_ids').mapped('lot_id').ids

    @api.one
    @api.depends('reserved_quant_ids.qty')
    def _compute_reserved_availability(self):
        self.reserved_availability = sum(self.mapped('reserved_quant_ids').mapped('qty'))

    @api.one
    @api.depends('state', 'product_id', 'product_qty', 'location_id')
    def _compute_product_availability(self):
        if self.state == 'done':
            self.availability = self.product_qty
        else:
            quants = self.env['stock.quant'].search([('location_id', 'child_of', self.location_id.id), ('product_id', '=', self.product_id.id), ('reservation_id', '=', False)])
            self.availability = min(self.product_qty, sum(quants.mapped('qty')))

    @api.multi
    def _compute_string_qty_information(self):
        precision = self.env['decimal.precision'].precision_get('Product Unit of Measure')
        void_moves = self.filtered(lambda move: move.state in ('draft', 'done', 'cancel') or move.location_id.usage != 'internal')
        other_moves = self - void_moves
        for move in void_moves:
            move.string_availability_info = ''  # 'not applicable' or 'n/a' could work too
        for move in other_moves:
            total_available = min(move.product_qty, move.reserved_availability + move.availability)
            total_available = move.product_id.uom_id._compute_quantity(total_available, move.product_uom, round=False)
            total_available = float_round(total_available, precision_digits=precision)
            info = str(total_available)
            if self.user_has_groups('product.group_uom'):
                info += ' ' + move.product_uom.name
            if move.reserved_availability:
                if move.reserved_availability != total_available:
                    # some of the available quantity is assigned and some are available but not reserved
                    reserved_available = move.product_id.uom_id._compute_quantity(move.reserved_availability, move.product_uom, round=False)
                    reserved_available = float_round(reserved_available, precision_digits=precision)
                    info += _(' (%s reserved)') % str(reserved_available)
                else:
                    # all available quantity is assigned
                    info += _(' (reserved)')
            move.string_availability_info = info

    @api.constrains('product_uom')
    def _check_uom(self):
        if any(move.product_id.uom_id.category_id.id != move.product_uom.category_id.id for move in self):
            raise UserError(_('You try to move a product using a UoM that is not compatible with the UoM of the product moved. Please use an UoM in the same UoM category.'))

    @api.model_cr
    def init(self):
        self._cr.execute('SELECT indexname FROM pg_indexes WHERE indexname = %s', ('stock_move_product_location_index',))
        if not self._cr.fetchone():
            self._cr.execute('CREATE INDEX stock_move_product_location_index ON stock_move (product_id, location_id, location_dest_id, company_id, state)')

    @api.multi
    def name_get(self):
        res = []
        for move in self:
            res.append((move.id, '%s%s%s>%s' % (
                move.picking_id.origin and '%s/' % move.picking_id.origin or '',
                move.product_id.code and '%s: ' % move.product_id.code or '',
                move.location_id.name, move.location_dest_id.name)))
        return res

    @api.model
    def create(self, vals):
        # TDE CLEANME: why doing this tracking on picking here ? seems weird
        perform_tracking = not self.env.context.get('mail_notrack') and vals.get('picking_id')
        if perform_tracking:
            picking = self.env['stock.picking'].browse(vals['picking_id'])
            initial_values = {picking.id: {'state': picking.state}}
        vals['ordered_qty'] = vals.get('product_uom_qty')
        res = super(StockMove, self).create(vals)
        if perform_tracking:
            picking.message_track(picking.fields_get(['state']), initial_values)
        return res

    @api.multi
    def write(self, vals):
        # TDE CLEANME: it is a gros bordel + tracking
        Picking = self.env['stock.picking']
        # Check that we do not modify a stock.move which is done
        frozen_fields = ['product_qty', 'product_uom', 'location_id', 'location_dest_id', 'product_id']
        if any(fname in frozen_fields for fname in vals.keys()) and any(move.state == 'done' for move in self):
            raise UserError(_('Quantities, Units of Measure, Products and Locations cannot be modified on stock moves that have already been processed (except by the Administrator).'))

        propagated_changes_dict = {}
        #propagation of expected date:
        propagated_date_field = False
        if vals.get('date_expected'):
            #propagate any manual change of the expected date
            propagated_date_field = 'date_expected'
        elif (vals.get('state', '') == 'done' and vals.get('date')):
            #propagate also any delta observed when setting the move as done
            propagated_date_field = 'date'

        if not self._context.get('do_not_propagate', False) and (propagated_date_field or propagated_changes_dict):
            #any propagation is (maybe) needed
            for move in self:
                if move.move_dest_ids and move.propagate:
                    move_dest_id = move.move_dest_ids[0] # TODO: do it for all move_dest_ids (with a for instead)
                    if 'date_expected' in propagated_changes_dict:
                        propagated_changes_dict.pop('date_expected')
                    if propagated_date_field:
                        current_date = datetime.strptime(move.date_expected, DEFAULT_SERVER_DATETIME_FORMAT)
                        new_date = datetime.strptime(vals.get(propagated_date_field), DEFAULT_SERVER_DATETIME_FORMAT)
                        delta = new_date - current_date
                        if abs(delta.days) >= move.company_id.propagation_minimum_delta:
                            old_move_date = datetime.strptime(move_dest_id.date_expected, DEFAULT_SERVER_DATETIME_FORMAT)
                            new_move_date = (old_move_date + relativedelta.relativedelta(days=delta.days or 0)).strftime(DEFAULT_SERVER_DATETIME_FORMAT)
                            propagated_changes_dict['date_expected'] = new_move_date
                    #For pushed moves as well as for pulled moves, propagate by recursive call of write().
                    #Note that, for pulled moves we intentionally don't propagate on the procurement.
                    if propagated_changes_dict:
                        move_dest_id.write(propagated_changes_dict)
        track_pickings = not self._context.get('mail_notrack') and any(field in vals for field in ['state', 'picking_id', 'partially_available'])
        if track_pickings:
            to_track_picking_ids = set([move.picking_id.id for move in self if move.picking_id])
            if vals.get('picking_id'):
                to_track_picking_ids.add(vals['picking_id'])
            to_track_picking_ids = list(to_track_picking_ids)
            pickings = Picking.browse(to_track_picking_ids)
            initial_values = dict((picking.id, {'state': picking.state}) for picking in pickings)
        res = super(StockMove, self).write(vals)
        if track_pickings:
            pickings.message_track(pickings.fields_get(['state']), initial_values)
        return res

    # Misc tools
    # ------------------------------------------------------------

    def get_price_unit(self):
        """ Returns the unit price to store on the quant """
        return self.price_unit or self.product_id.standard_price

    def get_removal_strategy(self):
        ''' Returns the removal strategy to consider for the given move/ops '''
        if self.product_id.categ_id.removal_strategy_id:
            return self.product_id.categ_id.removal_strategy_id.method
        loc = self.location_id
        while loc:
            if loc.removal_strategy_id:
                return loc.removal_strategy_id.method
            loc = loc.location_id
        return 'fifo'

    def _filter_closed_moves(self):
        """ Helper methods when having to avoid working on moves that are
        already done or canceled. In a lot of cases you may handle a batch
        of stock moves, some being already done / canceled, other being still
        under computation. Instead of having to use filtered everywhere and
        forgot some of them, use this tool instead. """
        return self.filtered(lambda move: move.state not in ('done', 'cancel'))

    @api.multi
    def split_move_operation(self):
        ctx = dict(self.env.context)
        self.ensure_one()
        view = self.env.ref('stock.view_stock_move_operations')
#         serial = (self.has_tracking == 'serial')
#         only_create = False  # Check operation type in theory
#         show_reserved = any([x for x in self.pack_operation_ids if x.product_qty > 0.0])
#         ctx.update({
#             'serial': serial,
#             'only_create': only_create,
#             'create_lots': True,
#             'state_done': self.is_done,
#             'show_reserved': show_reserved,
#         })
        result = {
            'name': _('Register Operations'),
            'type': 'ir.actions.act_window',
            'view_type': 'form',
            'view_mode': 'form',
            'res_model': 'stock.move',
            'views': [(view.id, 'form')],
            'view_id': view.id,
            'target': 'new',
            'res_id': self.id,
            'context': ctx,
        }
        return result

    # Main actions
    # ------------------------------------------------------------
    @api.multi
    def save(self):
        return True

    @api.multi
    def do_unreserve(self):
        if any(move.state in ('done', 'cancel') for move in self):
            raise UserError(_('Cannot unreserve a done move'))
        self.quants_unreserve()
        if not self.env.context.get('no_state_change'):
            waiting = self.filtered(lambda move: move.move_orig_ids)
            waiting.write({'state': 'waiting'})
            (self - waiting).write({'state': 'confirmed'})

    def _push_apply(self):
        # TDE CLEANME: I am quite sure I already saw this code somewhere ... in routing ??
        Push = self.env['stock.location.path']
        for move in self:
            # if the move is already chained, there is no need to check push rules
            if move.move_dest_ids:
                continue
            # if the move is a returned move, we don't want to check push rules, as returning a returned move is the only decent way
            # to receive goods without triggering the push rules again (which would duplicate chained operations)
            domain = [('location_from_id', '=', move.location_dest_id.id)]
            # priority goes to the route defined on the product and product category
            routes = move.product_id.route_ids | move.product_id.categ_id.total_route_ids
            rules = Push.search(domain + [('route_id', 'in', routes.ids)], order='route_sequence, sequence', limit=1)
            if not rules:
                # TDE FIXME/ should those really be in a if / elif ??
                # then we search on the warehouse if a rule can apply
                if move.warehouse_id:
                    rules = Push.search(domain + [('route_id', 'in', move.warehouse_id.route_ids.ids)], order='route_sequence, sequence', limit=1)
                elif move.picking_id.picking_type_id.warehouse_id:
                    rules = Push.search(domain + [('route_id', 'in', move.picking_id.picking_type_id.warehouse_id.route_ids.ids)], order='route_sequence, sequence', limit=1)
            # Make sure it is not returning the return
            if rules and (not move.origin_returned_move_id or move.origin_returned_move_id.location_dest_id.id != rules.location_dest_id.id):
                rules._apply(move)
        return True

    @api.onchange('product_id', 'product_qty')
    def onchange_quantity(self):
        if not self.product_id or self.product_qty < 0.0:
            self.product_qty = 0.0
        if self.product_qty < self._origin.product_qty:
            return {'warning': _("By changing this quantity here, you accept the "
                                 "new quantity as complete: Odoo will not "
                                 "automatically generate a back order.")}

    @api.onchange('product_id')
    def onchange_product_id(self):
        product = self.product_id.with_context(lang=self.partner_id.lang or self.env.user.lang)
        self.name = product.partner_ref
        self.product_uom = product.uom_id.id
        self.product_uom_qty = 1.0
        return {'domain': {'product_uom': [('category_id', '=', product.uom_id.category_id.id)]}}

    @api.onchange('date')
    def onchange_date(self):
        if self.date_expected:
            self.date = self.date_expected

    # TDE DECORATOR: remove that api.multi when action_confirm is migrated
    @api.multi
    def assign_picking(self):
        """ Try to assign the moves to an existing picking that has not been
        reserved yet and has the same procurement group, locations and picking
        type (moves should already have them identical). Otherwise, create a new
        picking to assign them to. """
        Picking = self.env['stock.picking']

        # If this method is called in batch by a write on a one2many and
        # at some point had to create a picking, some next iterations could
        # try to find back the created picking. As we look for it by searching
        # on some computed fields, we have to force a recompute, else the
        # record won't be found.
        self.recompute()

        for move in self:
            picking = Picking.search([
                ('group_id', '=', move.group_id.id),
                ('location_id', '=', move.location_id.id),
                ('location_dest_id', '=', move.location_dest_id.id),
                ('picking_type_id', '=', move.picking_type_id.id),
                ('printed', '=', False),
                ('state', 'in', ['draft', 'confirmed', 'waiting', 'partially_available', 'assigned'])], limit=1)
            if not picking:
                picking = Picking.create(move._get_new_picking_values())
            move.write({'picking_id': picking.id})
        return True
    _picking_assign = assign_picking

    def _get_new_picking_values(self):
        """ Prepares a new picking for this move as it could not be assigned to
        another picking. This method is designed to be inherited. """
        return {
            'origin': self.origin,
            'company_id': self.company_id.id,
            'move_type': self.group_id and self.group_id.move_type or 'direct',
            'partner_id': self.partner_id.id,
            'picking_type_id': self.picking_type_id.id,
            'location_id': self.location_id.id,
            'location_dest_id': self.location_dest_id.id,
        }
    _prepare_picking_assign = _get_new_picking_values

    @api.multi
    def action_confirm(self):
        """ Confirms stock move or put it in waiting if it's linked to another move. """
        move_create_proc = self.env['stock.move']
        move_to_confirm = self.env['stock.move']
        move_waiting = self.env['stock.move']

        to_assign = {}
        self.set_default_price_unit_from_product()
        for move in self:
            # if the move is preceeded, then it's waiting (if preceeding move is done, then action_assign has been called already and its state is already available)
            if move.move_orig_ids:
                move_waiting |= move
            else:
                if move.procure_method == 'make_to_order':
                    move_create_proc |= move
                else:
                    move_to_confirm |= move
            if not move.picking_id and move.picking_type_id:
                key = (move.group_id.id, move.location_id.id, move.location_dest_id.id)
                if key not in to_assign:
                    to_assign[key] = self.env['stock.move']
                to_assign[key] |= move

        # create procurements for make to order moves
        procurements = self.env['procurement.order']
        for move in move_create_proc:
            procurements |= procurements.create(move._prepare_procurement_from_move())
        if procurements:
            procurements.run()

        move_to_confirm.write({'state': 'confirmed'})
        (move_waiting | move_create_proc).write({'state': 'waiting'})

        # assign picking in batch for all confirmed move that share the same details
        for key, moves in to_assign.items():
            moves.assign_picking()
        self._push_apply()
        return self

    def set_default_price_unit_from_product(self):
        """ Set price to move, important in inter-company moves or receipts with only one partner """
        for move in self.filtered(lambda move: not move.price_unit):
            move.write({'price_unit': move.product_id.standard_price})
    attribute_price = set_default_price_unit_from_product

    def _prepare_procurement_from_move(self):
        origin = (self.group_id and (self.group_id.name + ":") or "") + (self.rule_id and self.rule_id.name or self.origin or self.picking_id.name or "/")
        group_id = self.group_id and self.group_id.id or False
        if self.rule_id:
            if self.rule_id.group_propagation_option == 'fixed' and self.rule_id.group_id:
                group_id = self.rule_id.group_id.id
            elif self.rule_id.group_propagation_option == 'none':
                group_id = False
        return {
            'name': self.rule_id and self.rule_id.name or "/",
            'origin': origin,
            'company_id': self.company_id.id,
            'date_planned': self.date,
            'product_id': self.product_id.id,
            'product_qty': self.product_uom_qty,
            'product_uom': self.product_uom.id,
            'location_id': self.location_id.id,
            'move_dest_ids': [(4, self.id)],
            'group_id': group_id,
            'route_ids': [(4, x.id) for x in self.route_ids],
            'warehouse_id': self.warehouse_id.id or (self.picking_type_id and self.picking_type_id.warehouse_id.id or False),
            'priority': self.priority,
        }

    @api.multi
    def force_assign(self):
        # TDE CLEANME: removed return value
        self.write({'state': 'assigned'})
        self.check_recompute_pack_op()

    # TDE DECORATOR: internal
    @api.multi
    def check_recompute_pack_op(self):
        pickings = self.mapped('picking_id').filtered(lambda picking: picking.state not in ('waiting', 'confirmed'))  # In case of 'all at once' delivery method it should not prepare pack operations
        # Check if someone was treating the picking already
        pickings_partial = pickings.filtered(lambda picking: not any(operation.qty_done for operation in picking.pack_operation_ids))
        pickings_partial.do_prepare_partial()
        (pickings - pickings_partial).write({'recompute_pack_op': True})

    @api.multi
    def check_tracking(self, pack_operation):
        """ Checks if serial number is assigned to stock move or not and raise an error if it had to. """
        # TDE FIXME: I cannot able to understand
        for move in self:
            if move.picking_id and \
                    (move.picking_id.picking_type_id.use_existing_lots or move.picking_id.picking_type_id.use_create_lots) and \
                    move.product_id.tracking != 'none' and \
                    not (move.restrict_lot_id or (pack_operation and (pack_operation.product_id and pack_operation.pack_lot_ids)) or (pack_operation and not pack_operation.product_id)):
                raise UserError(_('You need to provide a Lot/Serial Number for product %s') % move.product_id.name)

    @api.multi
    def action_assign(self, no_prepare=False):
        """ Checks the product type and accordingly writes the state. """
        # TDE FIXME: remove decorator once everything is migrated
        # TDE FIXME: clean me, please
        main_domain = {}

        Quant = self.env['stock.quant']
        Uom = self.env['product.uom']
        moves_to_assign = self.env['stock.move']
        moves_to_do = self.env['stock.move']
        operations = self.env['stock.pack.operation']
        ancestors_list = {}

        # work only on in progress moves
        moves = self.filtered(lambda move: move.state in ['confirmed', 'waiting', 'assigned'])
        moves.filtered(lambda move: move.reserved_quant_ids).do_unreserve()
        for move in moves:
            if move.location_id.usage in ('supplier', 'inventory', 'production'):
                moves_to_assign |= move
                # TDE FIXME: what ?
                # in case the move is returned, we want to try to find quants before forcing the assignment
                if not move.origin_returned_move_id:
                    continue
            # if the move is preceeded, restrict the choice of quants in the ones moved previously in original move
            ancestors = move.move_orig_ids #find_move_ancestors()
            if move.product_id.type == 'consu' and not ancestors:
                moves_to_assign |= move
                continue
            else:
                moves_to_do |= move

                # we always search for yet unassigned quants
                main_domain[move.id] = [('reservation_id', '=', False), ('qty', '>', 0)]

                ancestors_list[move.id] = True if ancestors else False
                if move.state == 'waiting' and not ancestors:
                    # if the waiting move hasn't yet any ancestor (PO/MO not confirmed yet), don't find any quant available in stock
                    main_domain[move.id] += [('id', '=', False)]
                elif ancestors:
                    main_domain[move.id] += [('history_ids', 'in', ancestors.ids)]

                # if the move is returned from another, restrict the choice of quants to the ones that follow the returned move
                if move.origin_returned_move_id:
                    main_domain[move.id] += [('history_ids', 'in', move.origin_returned_move_id.id)]

        # Sort moves to reserve first the ones with ancestors, in case the same product is listed in
        # different stock moves.
        for move in sorted(moves_to_do, key=lambda x: -1 if ancestors_list.get(x.id) else 0):
            # then if the move isn't totally assigned, try to find quants without any specific domain
            if move.state != 'assigned' and not self.env.context.get('reserve_only_ops'):
                qty = move.product_qty
                quants = Quant.quants_get_preferred_domain(qty, move, domain=main_domain[move.id], preferred_domain_list=[])
                Quant.quants_reserve(quants, move)

        # force assignation of consumable products and incoming from supplier/inventory/production
        # Do not take force_assign as it would create pack operations
        if moves_to_assign:
            moves_to_assign.write({'state': 'assigned'})
        if not no_prepare:
            self.check_recompute_pack_op()

    @api.multi
    def action_cancel(self):
        """ Cancels the moves and if all moves are cancelled it cancels the picking. """
        # TDE DUMB: why is cancel_procuremetn in ctx we do quite nothing ?? like not updating the move ??
        if any(move.state == 'done' for move in self):
            raise UserError(_('You cannot cancel a stock move that has been set to \'Done\'.'))

        procurements = self.env['procurement.order']
        for move in self:
            if move.reserved_quant_ids:
                move.quants_unreserve()
            if not self.env.context.get('cancel_procurement'):
                if move.move_dest_ids:
                    if move.propagate:
                        # Check if the destination corresponds to all quantities, otherwise you are not sure which one to cancel
                        if float_compare(sum(x.product_qty for x in move.move_dest_ids), move.product_qty, precision_rounding=move.product_id.uom_id.rounding) == 0:
                            move.move_dest_ids.action_cancel() # TODO: logic for when it is not 
                    else:
                        # If waiting, the chain will be broken and we are not sure if we can still wait for it (=> could take from stock instead)
                        move.move_dest_ids.filtered(lambda x: x.state == 'waiting').write({'state': 'confirmed'})
                if move.procurement_ids:
                    procurements |= move.procurement_ids

        self.write({'state': 'cancel', 'move_dest_id': False})
        if procurements:
            procurements.check()
        return True

    def recalculate_move_state(self):
        '''Recompute the state of moves given because their reserved quants were used to fulfill another operation'''
        # TDE FIXME: what is the real purpose of this ? probably clean me
        for move in self:
            vals = {}
            reserved_quant_ids = move.reserved_quant_ids
            if len(reserved_quant_ids) > 0 and not move.partially_available:
                vals['partially_available'] = True
            if len(reserved_quant_ids) == 0 and move.partially_available:
                vals['partially_available'] = False
            if move.state == 'assigned':
                if move.move_orig_ids:
                    vals['state'] = 'waiting'
                else:
                    vals['state'] = 'confirmed'
            if vals:
                move.write(vals)

    @api.model
    def _move_quants_by_lot(self, ops, lot_qty, quants_taken, false_quants, lot_move_qty, quant_dest_package_id):
        """
        This function is used to process all the pack operation lots of a pack operation
        For every move:
            First, we check the quants with lot already reserved (and those are already subtracted from the lots to do)
            Then go through all the lots to process:
                Add reserved false lots lot by lot
                Check if there are not reserved quants or reserved elsewhere with that lot or without lot (with the traditional method)
        """
        return self.browse(lot_move_qty.keys())._move_quants_by_lot_v10(quants_taken, false_quants, ops, lot_qty, lot_move_qty, quant_dest_package_id)

    @api.multi
    def _move_quants_by_lot_v10(self, quants_taken, false_quants, pack_operation, lot_quantities, lot_move_quantities, dest_package_id):
        Quant = self.env['stock.quant']
        rounding = pack_operation.product_id.uom_id.rounding
        preferred_domain_list = [[('reservation_id', '=', False)], ['&', ('reservation_id', 'not in', self.ids), ('reservation_id', '!=', False)]]

        for move_rec_updateme in self:
            from collections import defaultdict
            lot_to_quants = defaultdict(list)

            # Assign quants already reserved with lot to the correct
            for quant in quants_taken:
                if quant[0] <= move_rec_updateme.reserved_quant_ids:
                    lot_to_quants[quant[0].lot_id.id].append(quant)

            false_quants_move = [x for x in false_quants if x[0].reservation_id.id == move_rec_updateme.id]
            for lot_id in lot_quantities.keys():
                redo_false_quants = False

                # Take remaining reserved quants with  no lot first
                # (This will be used mainly when incoming had no lot and you do outgoing with)
                while false_quants_move and float_compare(lot_quantities[lot_id], 0, precision_rounding=rounding) > 0 and float_compare(lot_move_quantities[move_rec_updateme.id], 0, precision_rounding=rounding) > 0:
                    qty_min = min(lot_quantities[lot_id], lot_move_quantities[move_rec_updateme.id])
                    if false_quants_move[0].qty > qty_min:
                        lot_to_quants[lot_id] += [(false_quants_move[0], qty_min)]
                        qty = qty_min
                        redo_false_quants = True
                    else:
                        qty = false_quants_move[0].qty
                        lot_to_quants[lot_id] += [(false_quants_move[0], qty)]
                        false_quants_move.pop(0)
                    lot_quantities[lot_id] -= qty
                    lot_move_quantities[move_rec_updateme.id] -= qty

                # Search other with first matching lots and then without lots
                if float_compare(lot_move_quantities[move_rec_updateme.id], 0, precision_rounding=rounding) > 0 and float_compare(lot_quantities[lot_id], 0, precision_rounding=rounding) > 0:
                    # Search if we can find quants with that lot
                    qty = min(lot_quantities[lot_id], lot_move_quantities[move_rec_updateme.id])
                    quants = Quant.quants_get_preferred_domain(
                        qty, move_rec_updateme, ops=pack_operation, lot_id=lot_id, domain=[('qty', '>', 0)],
                        preferred_domain_list=preferred_domain_list)
                    lot_to_quants[lot_id] += quants
                    lot_quantities[lot_id] -= qty
                    lot_move_quantities[move_rec_updateme.id] -= qty

                # Move all the quants related to that lot/move
                if lot_to_quants[lot_id]:
                    Quant.quants_move(
                        lot_to_quants[lot_id], move_rec_updateme, pack_operation.location_dest_id,
                        location_from=pack_operation.location_id, lot_id=lot_id,
                        owner_id=pack_operation.owner_id.id, src_package_id=pack_operation.package_id.id,
                        dest_package_id=dest_package_id)
                    if redo_false_quants:
                        false_quants_move = [x for x in move_rec_updateme.reserved_quant_ids if (not x.lot_id) and (x.owner_id.id == pack_operation.owner_id.id) and
                                             (x.location_id.id == pack_operation.location_id.id) and (x.package_id.id == pack_operation.package_id.id)]
        return True

    @api.multi
    def _create_extra_move(self):
        ''' Creates an extra move if necessary depending on extra quantities than foreseen or extra moves'''
        self.ensure_one()
        quantity_to_split = 0
        uom_qty_to_split = 0
        extra_move = self.env['stock.move']
        rounding = self.product_uom.rounding
        # Let us do it without comparison with procurement.  In manufacturing orders, it could be in handy 
        # as it updates the quantity along the line
        
        # You split also simply  when the quantity done is bigger than foreseen
        if float_compare(self.quantity_done, self.product_uom_qty, precision_rounding=rounding) > 0:
            quantity_to_split = self.quantity_done - self.product_uom_qty
            uom_qty_to_split = quantity_to_split # + no need to change existing self.product_uom_qty 
        if quantity_to_split:
            extra_move = self.copy(default={'quantity_done': quantity_to_split, 'product_uom_qty': uom_qty_to_split,
                                            'picking_id': self.picking_id.id})
            extra_move.action_confirm()
            qty_todo = self.quantity_done - quantity_to_split
            for packop in self.pack_operation_ids:
                if packop.qty_done:
                    if float_compare(qty_todo, packop.qty_done, precision_rounding=rounding) >= 0:
                        qty_todo -= packop.qty_done
                    elif float_compare(qty_todo, 0, precision_rounding=rounding) > 0:
                        #split
                        remaining = packop.qty_done - qty_todo
                        packop.qty_done = qty_todo
                        packop.copy(default={'move_id': extra_move.id, 'quantity_done': remaining})
                        qty_todo = 0
                    else:
                        packop.move_id = extra_move.id
        return extra_move

    @api.multi
    def action_done(self):
        ''' Validate moves based on a production order. '''
        moves = self.filtered(lambda x: x.state not in ('done', 'cancel'))
        quant_obj = self.env['stock.quant']
        moves_todo = self.env['stock.move']
        moves_to_unreserve = self.env['stock.move']
        #moves_to_backorder = []
        # Create extra moves where necessary
        for move in moves:
            # Here, the `quantity_done` was already rounded to the product UOM by the `do_produce` wizard. However,
            # it is possible that the user changed the value before posting the inventory by a value that should be
            # rounded according to the move's UOM. In this specific case, we chose to round up the value, because it
            # is what is expected by the user (if i consumed/produced a little more, the whole UOM unit should be
            # consumed/produced and the moves are split correctly).
            rounding = move.product_uom.rounding
            move.quantity_done = float_round(move.quantity_done, precision_rounding=rounding, rounding_method ='UP')
            if move.quantity_done <= 0:
                continue
            moves_todo |= move
            moves_todo |= move._create_extra_move()
        # Split moves where necessary and move quants
        for move in moves_todo:
            rounding = move.product_uom.rounding
            if float_compare(move.quantity_done, move.product_uom_qty, precision_rounding=rounding) < 0:
                # Need to do some kind of conversion here
                qty_split = move.product_uom._compute_quantity(move.product_uom_qty - move.quantity_done, move.product_id.uom_id)
                new_move = move.split(qty_split)
                #moves_to_backorder.append(new_move)
                # If you were already putting stock.move.lots on the next one in the work order, transfer those to the new move
                move.pack_operation_ids.filtered(lambda x: x.qty_done == 0.0).write({'move_id': new_move})
                self.browse(new_move).quantity_done = 0.0
            main_domain = [('qty', '>', 0)]
            preferred_domain = [('reservation_id', '=', move.id)]
            fallback_domain = [('reservation_id', '=', False)]
            fallback_domain2 = ['&', ('reservation_id', '!=', move.id), ('reservation_id', '!=', False)]
            preferred_domain_list = [preferred_domain] + [fallback_domain] + [fallback_domain2]
            for packop in move.pack_operation_ids:
                if float_compare(packop.qty_done, 0, precision_rounding=rounding) > 0:
                    if not packop.lot_id and move.has_tracking != 'none':
                        raise UserError(_('You need to supply a lot/serial number.'))
                    qty = move.product_uom._compute_quantity(packop.qty_done, move.product_id.uom_id)
                    quants = quant_obj.quants_get_preferred_domain(qty, move, ops=packop, domain=main_domain, preferred_domain_list=preferred_domain_list)
                    self.env['stock.quant'].quants_move(quants, move, packop.location_dest_id, location_from=packop.location_id, lot_id=packop.lot_id.id, 
                                                        src_package_id=packop.package_id.id, dest_package_id=packop.result_package_id.id, 
                                                        owner_id=packop.owner_id.id) # TODO: need to see for entire pack
            moves_to_unreserve |= move
            if move.move_dest_ids:
                move.move_dest_ids.action_assign()
            if move.move_orig_ids:
                # As you can not link the moves 
                moves_filtered = move.move_orig_ids.filtered(lambda x: x.state != 'done')
                moves_filtered.write({'move_dest_ids': [(3, move.id)]})
        moves_to_unreserve.quants_unreserve()
        picking = self[0].picking_id
        moves_todo.write({'state': 'done', 'date': fields.Datetime.now()})
        moves_to_backorder = picking.move_lines.filtered(lambda x: x.state not in ('done', 'cancel'))
        backorder_picking = picking.copy({
                'name': '/',
                'move_lines': [],
                'pack_operation_ids': [],
                'backorder_id': picking.id
            })
        picking.message_post('Backorder Created') #message needs to be improved
        moves_to_backorder.write({'picking_id': backorder_picking.id})
        return moves_todo

    @api.multi
    def unlink(self):
        if any(move.state not in ('draft', 'cancel') for move in self):
            raise UserError(_('You can only delete draft moves.'))
        return super(StockMove, self).unlink()

    @api.multi
    def split(self, qty, restrict_lot_id=False, restrict_partner_id=False):
        """ Splits qty from move move into a new move

        :param qty: float. quantity to split (given in product UoM)
        :param restrict_lot_id: optional production lot that can be given in order to force the new move to restrict its choice of quants to this lot.
        :param restrict_partner_id: optional partner that can be given in order to force the new move to restrict its choice of quants to the ones belonging to this partner.
        :param context: dictionay. can contains the special key 'source_location_id' in order to force the source location when copying the move
        :returns: id of the backorder move created """
        self = self.with_prefetch() # This makes the ORM only look for one record and not 300 at a time, which improves performance
        if self.state in ('done', 'cancel'):
            raise UserError(_('You cannot split a move done'))
        elif self.state == 'draft':
            # we restrict the split of a draft move because if not confirmed yet, it may be replaced by several other moves in
            # case of phantom bom (with mrp module). And we don't want to deal with this complexity by copying the product that will explode.
            raise UserError(_('You cannot split a draft move. It needs to be confirmed first.'))
        if float_is_zero(qty, precision_rounding=self.product_id.uom_id.rounding) or self.product_qty <= qty:
            return self.id
        # HALF-UP rounding as only rounding errors will be because of propagation of error from default UoM
        uom_qty = self.product_id.uom_id._compute_quantity(qty, self.product_uom, rounding_method='HALF-UP')
        defaults = {
            'product_uom_qty': uom_qty,
            'procure_method': 'make_to_stock',
            'restrict_lot_id': restrict_lot_id,
            'procurement_ids': self.procurement_ids.ids, #TODO: more logic needed here
            'move_dest_ids': [(4, x.id) for x in self.move_dest_ids if x.state not in ('done', 'cancel')],
            'origin_returned_move_id': self.origin_returned_move_id.id,
        }
        if restrict_partner_id:
            defaults['restrict_partner_id'] = restrict_partner_id

        # TDE CLEANME: remove context key + add as parameter
        if self.env.context.get('source_location_id'):
            defaults['location_id'] = self.env.context['source_location_id']
        new_move = self.copy(defaults)
        # ctx = context.copy()
        # TDE CLEANME: used only in write in this file, to clean
        # ctx['do_not_propagate'] = True
        self.with_context(do_not_propagate=True).write({'product_uom_qty': self.product_uom_qty - uom_qty})
        # returning the first element of list returned by action_confirm is ok because we checked it wouldn't be exploded (and
        # thus the result of action_confirm should always be a list of 1 element length)
        new_move.action_confirm()
        # TDE FIXME: due to action confirm change
        return new_move.id #TODO: better to have an ID

    @api.multi
    def action_show_picking(self):
        view = self.env.ref('stock.view_picking_form')
        return {
            'name': _('Transfer'),
            'type': 'ir.actions.act_window',
            'view_type': 'form',
            'view_mode': 'form',
            'res_model': 'stock.picking',
            'views': [(view.id, 'form')],
            'view_id': view.id,
            'target': 'new',
            'res_id': self.id}
    show_picking = action_show_picking

    # Quants management
    # ----------------------------------------------------------------------

    def quants_unreserve(self):
        self.filtered(lambda x: x.partially_available).write({'partially_available': False})
        self.mapped('reserved_quant_ids').sudo().write({'reservation_id': False})
