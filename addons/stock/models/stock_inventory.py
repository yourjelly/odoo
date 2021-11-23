# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import re
from odoo import _, api, fields, models
from odoo.exceptions import UserError
from odoo.osv import expression
from odoo.tools.float_utils import float_compare


class StockInventory(models.Model):
    _name = 'stock.inventory'
    _description = 'Inventory'
    _inherits = {'stock.quant': 'quant_id'}

    def _domain_location_id(self):
        return [('usage', 'in', ['internal', 'transit'])]

    def _domain_lot_id(self):
        domain = [
            "'|'",
            "('company_id', '=', company_id)",
            "('company_id', '=', False)"
        ]
        if self.env.context.get('active_model') == 'product.product':
            domain.insert(0, "('product_id', '=', %s)" %
                          self.env.context.get('active_id'))
        elif self.env.context.get('active_model') == 'product.template':
            product_template = self.env['product.template'].browse(
                self.env.context.get('active_id'))
            if product_template.exists():
                domain.insert(0, "('product_id', 'in', %s)" %
                              product_template.product_variant_ids.ids)
        else:
            domain.insert(0, "('product_id', '=', product_id)")
        return '[' + ', '.join(domain) + ']'

    def _domain_product_id(self):
        domain = [('type', '=', 'product')]
        if self.env.context.get('product_tmpl_ids') or self.env.context.get('product_tmpl_id'):
            products = self.env.context.get(
                'product_tmpl_ids', []) + [self.env.context.get('product_tmpl_id', 0)]
            domain = expression.AND(
                [domain, [('product_tmpl_id', 'in', products)]])
        return domain

    # Link to stock.quant
    quant_id = fields.Many2one(
        'stock.quant', string='Quant',
        index=True, ondelete="cascade", required=True)
    location_id = fields.Many2one(
        'stock.location', related='quant_id.location_id', inherited=True,
        domain=lambda self: self._domain_location_id())
    lot_id = fields.Many2one(
        'stock.production.lot', related='quant_id.lot_id', inherited=True,
        domain=lambda self: self._domain_lot_id())
    product_id = fields.Many2one(
        'product.product', related='quant_id.product_id', inherited=True,
        domain=lambda self: self._domain_product_id())

    inventory_quantity = fields.Float(
        'Counted Quantity', digits='Product Unit of Measure',
        help="The product's counted quantity.")
    inventory_quantity_auto_apply = fields.Float(
        'Inventoried Quantity', compute='_compute_inventory_quantity_auto_apply',
        inverse='_set_inventory_quantity', groups='stock.group_stock_manager'
    )
    inventory_diff_quantity = fields.Float(
        'Difference', compute='_compute_inventory_diff_quantity', store=True,
        help="Indicates the gap between the product's theoretical quantity and its counted quantity.",
        readonly=True, digits='Product Unit of Measure')
    inventory_date = fields.Date(
        'Scheduled Date', compute='_compute_inventory_date', store=True, readonly=False,
        help="Next date the On Hand Quantity should be counted.")
    inventory_quantity_set = fields.Boolean(
        store=True, compute='_compute_inventory_quantity_set', readonly=False)
    is_outdated = fields.Boolean(
        'Quantity has been moved since last count', compute='_compute_is_outdated')
    user_id = fields.Many2one(
        'res.users', 'Assigned To', help="User assigned to do product count.")

    @api.depends('location_id')
    def _compute_inventory_date(self):
        quants = self.filtered(lambda q: not q.inventory_date and q.location_id.usage in [
                               'internal', 'transit'])
        date_by_location = {loc: loc._get_next_inventory_date()
                            for loc in quants.location_id}
        for quant in quants:
            quant.inventory_date = date_by_location[quant.location_id]

    @api.depends('inventory_quantity')
    def _compute_inventory_diff_quantity(self):
        for quant in self:
            quant.inventory_diff_quantity = quant.inventory_quantity - quant.quantity

    @api.depends('inventory_quantity')
    def _compute_inventory_quantity_set(self):
        self.inventory_quantity_set = True

    @api.depends('inventory_quantity', 'quantity', 'product_id')
    def _compute_is_outdated(self):
        self.is_outdated = False
        for quant in self:
            if quant.product_id and float_compare(quant.inventory_quantity - quant.inventory_diff_quantity, quant.quantity, precision_rounding=quant.product_uom_id.rounding) and quant.inventory_quantity_set:
                quant.is_outdated = True

    @api.depends('quantity')
    def _compute_inventory_quantity_auto_apply(self):
        for quant in self:
            quant.inventory_quantity_auto_apply = quant.quantity

    def _set_inventory_quantity(self):
        """ Inverse method to create stock move when `inventory_quantity` is set
        (`inventory_quantity` is only accessible in inventory mode).
        """
        for quant in self:
            quant.inventory_quantity = quant.inventory_quantity_auto_apply
        self.action_apply_inventory()

    @api.onchange('location_id', 'product_id', 'lot_id', 'package_id', 'owner_id')
    def _onchange_location_or_product_id(self):
        vals = {}

        # Once the new line is complete, fetch the new theoretical values.
        if self.product_id and self.location_id:
            # Sanity check if a lot has been set.
            if self.lot_id:
                if self.tracking == 'none' or self.product_id != self.lot_id.product_id:
                    vals['lot_id'] = None

            quant = self.env['stock.quant']._gather(
                self.product_id, self.location_id, lot_id=self.lot_id,
                package_id=self.package_id, owner_id=self.owner_id, strict=True)
            if quant:
                self.quantity = quant.quantity

            # Special case: directly set the quantity to one for serial numbers,
            # it'll trigger `inventory_quantity` compute.
            if self.lot_id and self.tracking == 'serial':
                vals['inventory_quantity'] = 1
                vals['inventory_quantity_auto_apply'] = 1

        if vals:
            self.update(vals)

    @api.onchange('inventory_quantity')
    def _onchange_inventory_quantity(self):
        if self.location_id and self.location_id.usage == 'inventory':
            warning = {
                'title': _('You cannot modify inventory loss quantity'),
                'message': _(
                    'Editing quantities in an Inventory Adjustment location is forbidden,'
                    'those locations are used as counterpart when correcting the quantities.'
                )
            }
            return {'warning': warning}

    @api.onchange('lot_id')
    def _onchange_serial_number(self):
        if self.lot_id and self.product_id.tracking == 'serial':
            message, dummy = self.env['stock.quant']._check_serial_number(self.product_id,
                                                                          self.lot_id,
                                                                          self.company_id)
            if message:
                return {'warning': {'title': _('Warning'), 'message': message}}

    @api.onchange('product_id', 'company_id')
    def _onchange_product_id(self):
        if self.location_id:
            return
        if self.product_id.tracking in ['lot', 'serial']:
            previous_quants = self.env['stock.quant'].search([
                ('product_id', '=', self.product_id.id),
                ('location_id.usage', 'in', ['internal', 'transit'])], limit=1, order='create_date desc')
            if previous_quants:
                self.location_id = previous_quants.location_id
        if not self.location_id:
            company_id = self.company_id and self.company_id.id or self.env.company.id
            self.location_id = self.env['stock.warehouse'].search(
                [('company_id', '=', company_id)], limit=1).in_type_id.default_location_dest_id

    @api.model
    def create(self, vals):
        """ Override to handle the "inventory mode" and create a quant as
        superuser the conditions are met.
        """
        self.check_access_rights('create')
        self.check_access_rule('create')
        # Create an empty inventory or write on a similar one.
        product = self.env['product.product'].browse(vals['product_id'])
        location = self.env['stock.location'].browse(vals['location_id'])
        lot_id = self.env['stock.production.lot'].browse(
            vals.get('lot_id'))
        package_id = self.env['stock.quant.package'].browse(
            vals.get('package_id'))
        owner_id = self.env['res.partner'].browse(vals.get('owner_id'))
        quant = self.env['stock.quant']._gather(product, location, lot_id=lot_id,
                             package_id=package_id, owner_id=owner_id, strict=True)
        if quant:
            inventory = quant[0].inventory_ids[:1]
        else:
            inventory = super(StockInventory, self.sudo()).create(vals)
        return inventory

    @api.model
    def action_view_inventory_report(self, extend=True):
        """ Returns an action to open (non-inventory adjustment) quant view.
        Depending of the context (user have right to be inventory mode or not),
        the list view will be editable or readonly.

        :param domain: List for the domain, empty by default.
        :param extend: If True, enables form, graph and pivot views. False by default.
        """
        self.env['stock.quant']._quant_tasks()
        ctx = dict(self.env.context or {})
        ctx.pop('group_by', None)
        action = {
            'name': _('Stock On Hand'),
            'view_type': 'tree',
            'view_mode': 'list,form',
            'res_model': 'stock.inventory',
            'type': 'ir.actions.act_window',
            'context': ctx,
            'domain': [],
            'help': """
                <p class="o_view_nocontent_empty_folder">No Stock On Hand</p>
                <p>This analysis gives you an overview of the current stock
                level of your products.</p>
                """
        }

        target_action = self.env.ref('stock.dashboard_open_quants', False)
        if target_action:
            action['id'] = target_action.id

        form_view = self.env.ref('stock.view_stock_quant_form_editable').id
        if self.user_has_groups('stock.group_stock_manager'):
            action['view_id'] = self.env.ref(
                'stock.view_stock_quant_tree_editable').id
        else:
            action['view_id'] = self.env.ref('stock.view_stock_quant_tree').id
        action.update({
            'views': [
                (action['view_id'], 'list'),
                (form_view, 'form'),
            ],
        })
        if extend:
            action.update({
                'view_mode': 'tree,form,pivot,graph',
                'views': [
                    (action['view_id'], 'list'),
                    (form_view, 'form'),
                    (self.env.ref('stock.view_stock_quant_pivot').id, 'pivot'),
                    (self.env.ref('stock.stock_quant_view_graph').id, 'graph'),
                ],
            })
        return action

    @api.model
    def action_view_inventory(self):
        """ Similar to _get_quants_action except specific for inventory adjustments (i.e. inventory counts). """
        self.env['stock.quant']._quant_tasks()

        ctx = dict(self.env.context or {})
        ctx['no_at_date'] = True
        if self.user_has_groups('stock.group_stock_user') and not self.user_has_groups('stock.group_stock_manager'):
            ctx['search_default_my_count'] = True
        action = {
            'name': _('Inventory Adjustments'),
            'view_mode': 'list',
            'view_id': self.env.ref('stock.view_stock_inventory_tree_editable').id,
            'res_model': 'stock.inventory',
            'type': 'ir.actions.act_window',
            'context': ctx,
            'domain': [('location_id.usage', 'in', ['internal', 'transit'])],
            'help': """
                <p class="o_view_nocontent_smiling_face">
                    Your stock is currently empty
                </p><p>
                    Press the CREATE button to define quantity for each product in your stock or import them from a spreadsheet throughout Favorites <span class="fa fa-long-arrow-right"/> Import</p>
                """
        }
        return action

    def action_apply_inventory(self):
        products_tracked_without_lot = []
        for quant in self:
            rounding = quant.product_uom_id.rounding
            if fields.Float.is_zero(quant.inventory_diff_quantity, precision_rounding=rounding)\
                    and fields.Float.is_zero(quant.inventory_quantity, precision_rounding=rounding)\
                    and fields.Float.is_zero(quant.quantity, precision_rounding=rounding):
                continue
            if quant.product_id.tracking in ['lot', 'serial'] and\
                    not quant.lot_id and quant.inventory_quantity != quant.quantity:
                products_tracked_without_lot.append(quant.product_id.id)
        # for some reason if multi-record, env.context doesn't pass to wizards...
        ctx = dict(self.env.context or {})
        ctx['default_quant_ids'] = self.ids
        quants_outdated = self.filtered(lambda quant: quant.is_outdated)
        if quants_outdated:
            ctx['default_quant_to_fix_ids'] = quants_outdated.ids
            return {
                'name': _('Conflict in Inventory Adjustment'),
                'type': 'ir.actions.act_window',
                'view_mode': 'form',
                'views': [(False, 'form')],
                'res_model': 'stock.inventory.conflict',
                'target': 'new',
                'context': ctx,
            }
        if products_tracked_without_lot:
            ctx['default_product_ids'] = products_tracked_without_lot
            return {
                'name': _('Tracked Products in Inventory Adjustment'),
                'type': 'ir.actions.act_window',
                'view_mode': 'form',
                'views': [(False, 'form')],
                'res_model': 'stock.track.confirmation',
                'target': 'new',
                'context': ctx,
            }
        self._apply_inventory()
        self.inventory_quantity_set = False

    def action_inventory_history(self):
        self.ensure_one()
        action = {
            'name': _('History'),
            'view_mode': 'list,form',
            'res_model': 'stock.move.line',
            'views': [(self.env.ref('stock.view_move_line_tree').id, 'list'), (False, 'form')],
            'type': 'ir.actions.act_window',
            'context': {
                'search_default_inventory': 1,
                'search_default_done': 1,
            },
            'domain': [
                ('product_id', '=', self.product_id.id),
                ('company_id', '=', self.company_id.id),
                '|',
                ('location_id', '=', self.location_id.id),
                ('location_dest_id', '=', self.location_id.id),
            ],
        }
        if self.lot_id:
            action['context']['search_default_lot_id'] = self.lot_id.id
        if self.package_id:
            action['context']['search_default_package_id'] = self.package_id.id
            action['context']['search_default_result_package_id'] = self.package_id.id
        if self.owner_id:
            action['context']['search_default_owner_id'] = self.owner_id.id
        return action

    def action_set_inventory_quantity(self):
        quants_already_set = self.filtered(
            lambda quant: quant.inventory_quantity_set)
        if quants_already_set:
            ctx = dict(self.env.context or {}, default_quant_ids=self.ids)
            view = self.env.ref('stock.inventory_warning_set_view', False)
            return {
                'name': _('Quantities Already Set'),
                'type': 'ir.actions.act_window',
                'view_mode': 'form',
                'views': [(view.id, 'form')],
                'view_id': view.id,
                'res_model': 'stock.inventory.warning',
                'target': 'new',
                'context': ctx,
            }
        for quant in self:
            quant.inventory_quantity = quant.quantity
        self.user_id = self.env.user.id
        self.inventory_quantity_set = True

    def action_reset(self):
        ctx = dict(self.env.context or {}, default_quant_ids=self.ids)
        view = self.env.ref('stock.inventory_warning_reset_view', False)
        return {
            'name': _('Quantities To Reset'),
            'type': 'ir.actions.act_window',
            'view_mode': 'form',
            'views': [(view.id, 'form')],
            'view_id': view.id,
            'res_model': 'stock.inventory.warning',
            'target': 'new',
            'context': ctx,
        }

    def action_set_inventory_quantity_to_zero(self):
        self.inventory_quantity = 0
        self.inventory_diff_quantity = 0
        self.inventory_quantity_set = False

    def _apply_inventory(self):
        move_vals = []
        if not self.user_has_groups('stock.group_stock_manager'):
            raise UserError(
                _('Only a stock manager can validate an inventory adjustment.'))
        for quant in self:
            # Create and validate a move so that the quant matches its `inventory_quantity`.
            if float_compare(quant.inventory_diff_quantity, 0, precision_rounding=quant.product_uom_id.rounding) > 0:
                move_vals.append(
                    quant._get_inventory_move_values(quant.inventory_diff_quantity,
                                                     quant.product_id.with_company(
                                                         quant.company_id).property_stock_inventory,
                                                     quant.location_id))
            else:
                move_vals.append(
                    quant._get_inventory_move_values(-quant.inventory_diff_quantity,
                                                     quant.location_id,
                                                     quant.product_id.with_company(
                                                         quant.company_id).property_stock_inventory,
                                                     out=True))
        moves = self.env['stock.move'].with_context(
            inventory_mode=False).create(move_vals)
        moves._action_done()
        self.location_id.write({'last_inventory_date': fields.Date.today()})
        date_by_location = {loc: loc._get_next_inventory_date()
                            for loc in self.mapped('location_id')}
        for quant in self:
            quant.inventory_date = date_by_location[quant.location_id]
        self.write({'inventory_quantity': 0, 'user_id': False})
        self.write({'inventory_diff_quantity': 0})

    def _get_inventory_move_values(self, qty, location_id, location_dest_id, out=False):
        """ Called when user manually set a new quantity (via `inventory_quantity`)
        just before creating the corresponding stock move.

        :param location_id: `stock.location`
        :param location_dest_id: `stock.location`
        :param out: boolean to set on True when the move go to inventory adjustment location.
        :return: dict with all values needed to create a new `stock.move` with its move line.
        """
        self.ensure_one()
        if fields.Float.is_zero(qty, 0, precision_rounding=self.product_uom_id.rounding):
            name = _('Product Quantity Confirmed')
        else:
            name = _('Product Quantity Updated')
        return {
            'name': self.env.context.get('inventory_name') or name,
            'product_id': self.product_id.id,
            'product_uom': self.product_uom_id.id,
            'product_uom_qty': qty,
            'company_id': self.company_id.id or self.env.company.id,
            'state': 'confirmed',
            'location_id': location_id.id,
            'location_dest_id': location_dest_id.id,
            'is_inventory': True,
            'move_line_ids': [(0, 0, {
                'product_id': self.product_id.id,
                'product_uom_id': self.product_uom_id.id,
                'qty_done': qty,
                'location_id': location_id.id,
                'location_dest_id': location_dest_id.id,
                'company_id': self.company_id.id or self.env.company.id,
                'lot_id': self.lot_id.id,
                'package_id': out and self.package_id.id or False,
                'result_package_id': (not out) and self.package_id.id or False,
                'owner_id': self.owner_id.id,
            })]
        }
