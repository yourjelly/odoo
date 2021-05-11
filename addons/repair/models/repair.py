# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from random import randint

from odoo import api, fields, models, _, Command
from odoo.exceptions import UserError, ValidationError
from odoo.tools import float_compare

from odoo.addons.stock.models.stock_move import PROCUREMENT_PRIORITIES


class Repair(models.Model):
    _name = 'repair.order'
    _description = 'Repair Order'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'priority DESC, scheduled_date DESC, id DESC'

    name = fields.Char(
        'Repair Reference', default='New',
        copy=False, required=True, readonly=True)
    priority = fields.Selection(
        PROCUREMENT_PRIORITIES, string='Priority', default='0',
        help="Products will be reserved first for the repair order with the highest priorities.")
    description = fields.Char('Repair Description')
    scheduled_date = fields.Datetime(
        'Scheduled Date', default=fields.Datetime.now, required=True)
    state = fields.Selection([
        ('draft', 'Draft'),
        ('confirmed', 'Confirmed'),
        ('under_repair', 'Under Repair'),
        ('done', 'Repaired'),
        ('cancel', 'Cancelled')], string='Status',
        copy=False, default='draft', readonly=True, tracking=True,
        help="* The \'Draft\' status is used when a user is encoding a new and unconfirmed repair order.\n"
             "* The \'Confirmed\' status is used when a user confirms the repair order.\n"
             "* The \'Under Repair\' status is used when the repair is ongoing.\n"
             "* The \'Done\' status is set when repairing is completed.\n"
             "* The \'Cancelled\' status is used when user cancel repair order.")
    location_id = fields.Many2one(
        'stock.location', 'Location',
        index=True, readonly=False, check_company=True,
        help="This is the location where the product to repair is located.",
        states={'draft': [('readonly', False)], 'confirmed': [('readonly', True)]})
    partner_id = fields.Many2one(
        'res.partner', 'Customer',
        index=True, check_company=True, change_default=True,
        help='Choose partner for whom the order will be invoiced and delivered. You can find a partner by its Name, TIN, Email or Internal Reference.')
    move_id = fields.Many2one(
        'stock.move', 'Move',
        copy=False, readonly=True, check_company=True,
        help="Move created by the repair order")
    internal_notes = fields.Text('Internal Notes')
    quotation_notes = fields.Text('Order Notes')
    user_id = fields.Many2one('res.users', string="Responsible", default=lambda self: self.env.user, check_company=True)
    company_id = fields.Many2one(
        'res.company', 'Company',
        readonly=True, required=True, index=True,
        default=lambda self: self.env.company)
    sale_order_id = fields.Many2one(
        'sale.order', 'Sale Order',
        help="Sale Order from which the product to be repaired comes from.")
    tag_ids = fields.Many2many('repair.tags', string="Tags")

    product_id = fields.Many2one(
        'product.product', string='Product to Repair',
        domain="[('type', 'in', ['product', 'consu']), '|', ('company_id', '=', company_id), ('company_id', '=', False)]",
        readonly=True, states={'draft': [('readonly', False)]}, check_company=True)
    product_qty = fields.Float(
        'Product Quantity',
        default=1.0, digits='Product Unit of Measure',
        readonly=True, states={'draft': [('readonly', False)]})
    product_uom = fields.Many2one(
        'uom.uom', 'Product Unit of Measure',
        readonly=True, states={'draft': [('readonly', False)]}, domain="[('category_id', '=', product_uom_category_id)]")
    product_uom_category_id = fields.Many2one(related='product_id.uom_id.category_id')
    tracking = fields.Selection(string='Product Tracking', related="product_id.tracking", readonly=False)
    lot_id = fields.Many2one(
        'stock.production.lot', 'Lot/Serial',
        domain="[('product_id','=', product_id), ('company_id', '=', company_id)]", check_company=True,
        help="Products repaired are all belonging to this lot")

    operations = fields.One2many('repair.line', 'repair_id', 'Parts', copy=True)
    fees_lines = fields.One2many('repair.fee', 'repair_id', 'Operations', copy=True)
    pricelist_id = fields.Many2one(
        'product.pricelist', 'Pricelist',
        default=lambda self: self.env['product.pricelist'].search([('company_id', 'in', [self.env.company.id, False])], limit=1).id,
        help='Pricelist of the selected partner.', check_company=True)
    currency_id = fields.Many2one(related='pricelist_id.currency_id')

    amount_untaxed = fields.Float('Untaxed Amount', compute='_compute_amount_untaxed', store=True)
    amount_tax = fields.Float('Taxes', compute='_compute_amount_tax', store=True)
    amount_total = fields.Float('Total', compute='_compute_amount_total', store=True)

    @api.depends('operations.price_subtotal', 'fees_lines.price_subtotal', 'pricelist_id.currency_id')
    def _compute_amount_untaxed(self):
        for order in self:
            total = sum(operation.price_subtotal for operation in order.operations)
            total += sum(fee.price_subtotal for fee in order.fees_lines)
            order.amount_untaxed = order.pricelist_id.currency_id.round(total)

    @api.depends('operations.price_unit', 'operations.product_uom_qty', 'operations.product_id',
                 'fees_lines.price_unit', 'fees_lines.product_uom_qty', 'fees_lines.product_id',
                 'pricelist_id.currency_id', 'partner_id')
    def _compute_amount_tax(self):
        for order in self:
            val = 0.0
            for operation in order.operations:
                if operation.tax_id:
                    tax_calculate = operation.tax_id.compute_all(operation.price_unit, order.pricelist_id.currency_id, operation.product_uom_qty, operation.product_id, order.partner_id)
                    for c in tax_calculate['taxes']:
                        val += c['amount']
            for fee in order.fees_lines:
                if fee.tax_id:
                    tax_calculate = fee.tax_id.compute_all(fee.price_unit, order.pricelist_id.currency_id, fee.product_uom_qty, fee.product_id, order.partner_id)
                    for c in tax_calculate['taxes']:
                        val += c['amount']
            order.amount_tax = val

    @api.depends('amount_untaxed', 'amount_tax')
    def _compute_amount_total(self):
        for order in self:
            order.amount_total = order.pricelist_id.currency_id.round(order.amount_untaxed + order.amount_tax)

    _sql_constraints = [
        ('name_uniq', 'unique(name, company_id)', 'Reference must be unique per company!'),
    ]

    @api.onchange('product_id')
    def _onchange_product_id(self):
        if self.product_id:
            self.product_uom = self.product_id.uom_id.id
            if self.lot_id and self.lot_id.product_id != self.product_id:
                self.lot_id = False
        else:
            self.product_uom = False
            self.lot_id = False

    @api.onchange('partner_id')
    def _onchange_partner_id(self):
        self = self.with_company(self.company_id)
        if not self.partner_id:
            self.pricelist_id = self.env['product.pricelist'].search([
                ('company_id', 'in', [self.env.company.id, False]),
            ], limit=1)
        else:
            self.pricelist_id = self.partner_id.property_product_pricelist.id

    @api.onchange('company_id')
    def _onchange_company_id(self):
        if self.company_id:
            warehouse = self.env['stock.warehouse'].search([('company_id', '=', self.company_id.id)], limit=1)
            self.location_id = warehouse.lot_stock_id
        else:
            self.location_id = False

    @api.ondelete(at_uninstall=False)
    def _unlink_except_confirmed(self):
        for order in self:
            if order.state not in ('draft', 'cancel'):
                raise UserError(_('You can not delete a repair order once it has been confirmed. You must first cancel it.'))
            if order.state == 'cancel' and order.sale_order_id:
                raise UserError(_('You can not delete a repair order which is linked to an sale order which has been confirmed.'))  # TODO

    @api.model
    def create(self, vals):
        # We generate a standard reference
        vals['name'] = self.env['ir.sequence'].next_by_code('repair.order') or '/'
        return super(Repair, self).create(vals)

    def action_repair_create_sale(self):
        so_values = []
        for repair in self:
            if repair.sale_order_id:
                continue
            so_values.append(repair._prepare_sale_order_values())
        self.env['sale.order'].create(so_values)
        return True

    def action_repair_to_draft(self):
        if self.filtered(lambda repair: repair.state != 'cancel'):
            raise UserError(_("Repair must be canceled in order to reset it to draft."))
        return self.write({'state': 'draft'})

    def action_repair_confirm(self):
        self.ensure_one()
        if self.filtered(lambda repair: any(op.product_uom_qty < 0 for op in repair.operations)):  # TODO manage the case
            raise UserError(_("You can not enter negative quantities."))
        if not self.product_id or self.product_id.type == 'consu':
            return self._action_repair_confirm()
        # TODO check if location is set ??
        # TODO use a simple forecasted instead
        available_qty_owner = self.env['stock.quant']._get_available_quantity(self.product_id, self.location_id, self.lot_id, owner_id=self.partner_id, strict=True)
        available_qty_noown = self.env['stock.quant']._get_available_quantity(self.product_id, self.location_id, self.lot_id, strict=True)
        repair_qty = self.product_uom._compute_quantity(self.product_qty, self.product_id.uom_id)
        precision = self.env['decimal.precision'].precision_get('Product Unit of Measure')
        for available_qty in [available_qty_owner, available_qty_noown]:
            if float_compare(available_qty, repair_qty, precision_digits=precision) >= 0:
                return self._action_repair_confirm()
        else:
            return {
                'name': self.product_id.display_name + _(': Insufficient Quantity To Repair'),
                'view_mode': 'form',
                'res_model': 'stock.warn.insufficient.qty.repair',
                'view_id': self.env.ref('repair.stock_warn_insufficient_qty_repair_form_view').id,
                'type': 'ir.actions.act_window',
                'context': {
                    'default_product_id': self.product_id.id,
                    'default_location_id': self.location_id.id,
                    'default_repair_id': self.id,
                    'default_quantity': repair_qty,
                    'default_product_uom_name': self.product_id.uom_name
                },
                'target': 'new'
            }

    def action_repair_start(self):
        """ Writes repair order state to 'Under Repair'
        @return: True
        """
        if self.filtered(lambda repair: repair.state != 'confirmed'):
            raise UserError(_("Repair must be confirmed before starting reparation."))
        return self.write({'state': 'under_repair'})

    def action_repair_end(self):
        """ Writes repair order state to done
        @return: True
        """
        if self.filtered(lambda repair: repair.state != 'under_repair'):
            raise UserError(_("Repair must be under repair in order to end reparation."))
        self._check_product_tracking()
        move_by_repair = self._action_repair_done()
        for repair in self:
            vals = {'state': 'done'}
            vals['move_id'] = move_by_repair.get(repair.id)
            repair.write(vals)
        return True

    def action_repair_cancel(self):
        # TODO Activity on sale order or canceled it ?
        return self.write({'state': 'cancel'})

    def print_repair_order(self):
        # TODO remake the report
        return self.env.ref('repair.action_report_repair_order').report_action(self)

    def action_open_sale_order(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'view_mode': 'form',
            'res_model': 'sale.order',
            'res_id': self.sale_order_id.id,
        }

    def _prepare_sale_order_values(self):
        self.ensure_one()
        if not self.partner_id:
            raise UserError("You should set a customer to create the sale order")
        company = self.company_id
        partner = self.partner_id
        partner_addr = partner.sudo().address_get(['invoice', 'delivery', 'contact'])
        return {
            'company_id': company.id,
            'team_id': self.env['crm.team'].with_context(allowed_company_ids=company.ids)._get_default_team_id(domain=[('company_id', '=', company.id)]).id,
            'warehouse_id': self.location_id.warehouse_id.id,
            'origin': self.name,
            'partner_id': partner.id,
            'pricelist_id': partner.property_product_pricelist.id,
            'partner_invoice_id': partner_addr['invoice'],
            'date_order': self.scheduled_date,
            'fiscal_position_id': partner.property_account_position_id.id,
            'payment_term_id': partner.property_payment_term_id.id,
            'user_id': False,
            'partner_shipping_id': partner_addr['delivery'],
            'repair_order_ids': Command.link(self.id),
            'order_line': [
                Command.create(operation._prepare_sale_order_line_values()) for operation in self.operations
            ] + [
                Command.create(fee._prepare_sale_order_line_values()) for fee in self.fees_lines
            ],
        }

    def _prepare_stock_move_values(self, owner_id):
        """ Return values for the repaired product """
        self.ensure_one()
        return {
            'name': self.name,
            'product_id': self.product_id.id,
            'product_uom': self.product_uom.id or self.product_id.uom_id.id,
            'product_uom_qty': self.product_qty,
            'partner_id': self.address_id.id,
            'location_id': self.location_id.id,
            'location_dest_id': self.location_id.id,
            'move_line_ids': [(0, 0, {
                'product_id': self.product_id.id,
                'lot_id': self.lot_id.id,
                'product_uom_qty': 0,  # bypass reservation here
                'product_uom_id': self.product_uom.id or self.product_id.uom_id.id,
                'qty_done': self.product_qty,
                'package_id': False,
                'result_package_id': False,
                'owner_id': owner_id,
                'location_id': self.location_id.id,  # TODO: owner stuff
                'company_id': self.company_id.id,
                'location_dest_id': self.location_id.id,
            })],
            'repair_id': self.id,
            'origin': self.name,
            'company_id': self.company_id.id,
        }

    def _action_repair_done(self):
        """ Creates stock move for operation and stock move for final product of repair order.
        @return: Move ids of final products

        """
        self._check_company()
        self.operations._check_company()
        self.fees_lines._check_company()
        res = {}
        precision = self.env['decimal.precision'].precision_get('Product Unit of Measure')
        Move = self.env['stock.move']
        for repair in self:
            # Try to create move with the appropriate owner
            owner_id = False
            available_qty_owner = self.env['stock.quant']._get_available_quantity(repair.product_id, repair.location_id, repair.lot_id, owner_id=repair.partner_id, strict=True)
            if float_compare(available_qty_owner, repair.product_qty, precision_digits=precision) >= 0:
                owner_id = repair.partner_id.id

            moves = self.env['stock.move']
            for operation in repair.operations:
                move = Move.create({
                    'name': repair.name,
                    'product_id': operation.product_id.id,
                    'product_uom_qty': operation.product_uom_qty,
                    'product_uom': operation.product_uom.id,
                    'partner_id': repair.address_id.id,
                    'location_id': operation.location_id.id,
                    'location_dest_id': operation.location_dest_id.id,
                    'repair_id': repair.id,
                    'origin': repair.name,
                    'company_id': repair.company_id.id,
                })

                # Best effort to reserve the product in a (sub)-location where it is available
                product_qty = move.product_uom._compute_quantity(
                    operation.product_uom_qty, move.product_id.uom_id, rounding_method='HALF-UP')
                available_quantity = self.env['stock.quant']._get_available_quantity(
                    move.product_id,
                    move.location_id,
                    lot_id=operation.lot_id,
                    strict=False,
                )
                move._update_reserved_quantity(
                    product_qty,
                    available_quantity,
                    move.location_id,
                    lot_id=operation.lot_id,
                    strict=False,
                )
                # Then, set the quantity done. If the required quantity was not reserved, negative
                # quant is created in operation.location_id.
                move._set_quantity_done(operation.product_uom_qty)

                if operation.lot_id:
                    move.move_line_ids.lot_id = operation.lot_id

                moves |= move
                operation.write({'move_id': move.id, 'state': 'done'})
            move = Move.create(self._prepare_stock_move_values(owner_id))
            consumed_lines = moves.mapped('move_line_ids')
            produced_lines = move.move_line_ids
            moves |= move
            moves._action_done()
            produced_lines.write({'consume_line_ids': [(6, 0, consumed_lines.ids)]})
            res[repair.id] = move.id
        return res

    def _action_repair_confirm(self):
        if self.filtered(lambda repair: repair.state != 'draft'):
            raise UserError(_("Only draft repairs can be confirmed."))
        self._check_company()
        self.operations._check_company()
        self.fees_lines._check_company()
        self.write({'state': 'confirmed'})
        return True

    def _check_product_tracking(self):
        invalid_lines = self.operations.filtered(lambda x: x.tracking != 'none' and not x.lot_id)
        if invalid_lines:
            products = invalid_lines.product_id
            raise ValidationError(_(
                "Serial number is required for operation lines with products: %s",
                ", ".join(products.mapped('display_name')),
            ))


class RepairLine(models.Model):
    _name = 'repair.line'
    _description = 'Repair Line (parts)'

    name = fields.Text('Description', required=True)
    repair_id = fields.Many2one(
        'repair.order', 'Repair Order Reference', required=True,
        index=True, ondelete='cascade', check_company=True)
    company_id = fields.Many2one(
        related='repair_id.company_id', store=True, index=True)
    currency_id = fields.Many2one(
        related='repair_id.currency_id')
    type = fields.Selection([
        ('add', 'Add'),
        ('remove', 'Remove')], 'Type', default='add', required=True)
    product_id = fields.Many2one(
        'product.product', 'Product', required=True, check_company=True,
        domain="[('type', 'in', ['product', 'consu']), '|', ('company_id', '=', company_id), ('company_id', '=', False)]")
    price_unit = fields.Float('Unit Price', required=True, digits='Product Price')
    price_subtotal = fields.Float('Subtotal', compute='_compute_price_subtotal', store=True, digits=0)
    tax_id = fields.Many2many(
        'account.tax', 'repair_operation_line_tax', 'repair_operation_line_id', 'tax_id', 'Taxes',
        domain="[('type_tax_use','=','sale'), ('company_id', '=', company_id)]", check_company=True)
    product_uom_qty = fields.Float(
        'Quantity', default=1.0,
        digits='Product Unit of Measure', required=True)
    product_uom = fields.Many2one(
        'uom.uom', 'Product Unit of Measure',
        required=True, domain="[('category_id', '=', product_uom_category_id)]")
    product_uom_category_id = fields.Many2one(related='product_id.uom_id.category_id')
    location_id = fields.Many2one(
        'stock.location', 'Source Location',
        required=True, check_company=True)
    location_dest_id = fields.Many2one(
        'stock.location', 'Dest. Location',
        required=True, check_company=True)
    move_id = fields.Many2one(
        'stock.move', 'Inventory Move',
        copy=False, readonly=True)
    lot_id = fields.Many2one(
        'stock.production.lot', 'Lot/Serial',
        domain="[('product_id','=', product_id), ('company_id', '=', company_id)]", check_company=True)
    tracking = fields.Selection(string='Product Tracking', related="product_id.tracking")
    sale_order_line_ids = fields.One2many('sale.order.line', 'repair_line_id')

    @api.depends('price_unit', 'repair_id', 'product_uom_qty', 'product_id')
    def _compute_price_subtotal(self):
        for line in self:
            taxes = line.tax_id.compute_all(line.price_unit, line.repair_id.pricelist_id.currency_id, line.product_uom_qty, line.product_id, line.repair_id.partner_id)
            line.price_subtotal = taxes['total_excluded']

    @api.onchange('type')
    def _onchange_operation_type(self):
        """ On change of operation type it sets source location, destination location.
        @param product: Changed operation type.
        @param guarantee_limit: Guarantee limit of current record.
        @return: Dictionary of values.
        """
        if not self.type:
            self.location_id = False
            self.location_dest_id = False
        elif self.type == 'add':
            self._onchange_product_id()
            args = self.repair_id.company_id and [('company_id', '=', self.repair_id.company_id.id)] or []
            warehouse = self.env['stock.warehouse'].search(args, limit=1)
            self.location_id = warehouse.lot_stock_id
            self.location_dest_id = self.env['stock.location'].search([('usage', '=', 'production'), ('company_id', '=', self.repair_id.company_id.id)], limit=1)
        else:
            self.price_unit = 0.0
            self.tax_id = False
            self.location_id = self.env['stock.location'].search([('usage', '=', 'production')], limit=1).id
            self.location_dest_id = self.env['stock.location'].search([('scrap_location', '=', True), ('company_id', 'in', [self.repair_id.company_id.id, False])], limit=1).id

    @api.onchange('repair_id', 'product_id', 'product_uom_qty')
    def _onchange_product_id(self):
        """ On change of product it sets product quantity, tax account, name,
        uom of product, unit price and price subtotal. """
        if not self.product_id or not self.product_uom_qty:
            return
        self = self.with_company(self.company_id)
        partner = self.repair_id.partner_id
        if partner:
            self = self.with_context(lang=partner.lang)
        product = self.product_id
        self.name = product.display_name
        if product.description_sale:
            if partner:
                self.name += '\n' + self.product_id.with_context(lang=partner.lang).description_sale
            else:
                self.name += '\n' + self.product_id.description_sale
        self.product_uom = product.uom_id.id
        if self.type != 'remove':
            if partner:
                fpos = self.env['account.fiscal.position'].get_fiscal_position(partner.id)
                taxes = self.product_id.taxes_id.filtered(lambda x: x.company_id == self.repair_id.company_id)
                self.tax_id = fpos.map_tax(taxes, self.product_id, partner).ids
            warning = False
            pricelist = self.repair_id.pricelist_id
            if not pricelist:
                warning = {
                    'title': _('No pricelist found.'),
                    'message':
                        _('You have to select a pricelist in the Repair form !\n Please set one before choosing a product.')}
                return {'warning': warning}
            else:
                self._onchange_product_uom()

    @api.onchange('product_uom')
    def _onchange_product_uom(self):
        partner = self.repair_id.partner_id
        pricelist = self.repair_id.pricelist_id
        if pricelist and self.product_id and self.type != 'remove':
            price = pricelist.get_product_price(self.product_id, self.product_uom_qty, partner, uom_id=self.product_uom.id)
            if price is False:
                warning = {
                    'title': _('No valid pricelist line found.'),
                    'message':
                        _("Couldn't find a pricelist line matching this product and quantity.\nYou have to change either the product, the quantity or the pricelist.")}
                return {'warning': warning}
            else:
                self.price_unit = price

    def create(self, vals_list):
        res = super().create(vals_list)

        res._sync_sale_order()
        res._sync_stock_move()

        return res

    def write(self, vals):
        res = super().write(vals)

        self._sync_sale_order(vals)
        self._sync_stock_move(vals)

        return res

    def _sync_sale_order(self, vals=False):
        create_values = []
        for line in self:
            if not line.repair_id.sale_order_id:
                continue
            if line.sale_order_line_ids:
                # TODO : avoid write for nothing ?? 
                line.sale_order_line_ids.write(self._prepare_sale_order_line_values())
            else:
                create_values.append(self._prepare_sale_order_line_values())
        self.env['sale.order.line'].create(create_values)

    def _sync_stock_move(self, vals=False):
        # TODO Manage change of location, location_dest, qty impact the stock move behind
        pass

    def _prepare_sale_order_line_values(self):
        self.ensure_one()
        res = {
            'name': self.name,
            'product_uom_qty': self.product_uom_qty if self.type == 'add' else -self.product_uom_qty,
            'product_id': self.product_id.id,
            'product_uom': self.product_uom.id,
            'price_unit': self.price_unit,
            'company_id': self.company_id.id,
            'currency_id': self.currency_id.id,
            'tax_id': self.tax_id.ids,
            'repair_line_id': self.id,
        }
        if self.repair_id.sale_order_id:
            res['order_id'] = self.repair_id.sale_order_id.id
        return res


class RepairFee(models.Model):
    _name = 'repair.fee'
    _description = 'Repair Fees'

    repair_id = fields.Many2one(
        'repair.order', 'Repair Order Reference',
        index=True, ondelete='cascade', required=True)
    company_id = fields.Many2one(
        related="repair_id.company_id", index=True, store=True)
    currency_id = fields.Many2one(
        related="repair_id.currency_id")
    name = fields.Text('Description', required=True)
    product_id = fields.Many2one(
        'product.product', 'Product', check_company=True,
        domain="[('type', '=', 'service'), '|', ('company_id', '=', company_id), ('company_id', '=', False)]")
    product_uom_qty = fields.Float('Quantity', digits='Product Unit of Measure', required=True, default=1.0)
    price_unit = fields.Float('Unit Price', required=True, digits='Product Price')
    product_uom = fields.Many2one('uom.uom', 'Product Unit of Measure', required=True, domain="[('category_id', '=', product_uom_category_id)]")
    product_uom_category_id = fields.Many2one(related='product_id.uom_id.category_id')
    price_subtotal = fields.Float('Subtotal', compute='_compute_price_subtotal', store=True, digits=0)
    tax_id = fields.Many2many(
        'account.tax', 'repair_fee_line_tax', 'repair_fee_line_id', 'tax_id', 'Taxes',
        domain="[('type_tax_use','=','sale'), ('company_id', '=', company_id)]", check_company=True)
    sale_order_line_ids = fields.One2many('sale.order.line', 'repair_line_id')

    @api.depends('price_unit', 'repair_id', 'product_uom_qty', 'product_id')
    def _compute_price_subtotal(self):
        for fee in self:
            taxes = fee.tax_id.compute_all(fee.price_unit, fee.repair_id.pricelist_id.currency_id, fee.product_uom_qty, fee.product_id, fee.repair_id.partner_id)
            fee.price_subtotal = taxes['total_excluded']

    @api.onchange('repair_id', 'product_id', 'product_uom_qty')
    def _onchange_product_id(self):
        """ On change of product it sets product quantity, tax account, name,
        uom of product, unit price and price subtotal. """
        if not self.product_id:
            return

        self = self.with_company(self.company_id)

        partner = self.repair_id.partner_id
        pricelist = self.repair_id.pricelist_id

        if partner and self.product_id:
            fpos = self.env['account.fiscal.position'].get_fiscal_position(partner.id)
            taxes = self.product_id.taxes_id.filtered(lambda x: x.company_id == self.repair_id.company_id)
            self.tax_id = fpos.map_tax(taxes, self.product_id, partner).ids
        if partner:
            self.name = self.product_id.with_context(lang=partner.lang).display_name
        else:
            self.name = self.product_id.display_name
        self.product_uom = self.product_id.uom_id.id
        if self.product_id.description_sale:
            if partner:
                self.name += '\n' + self.product_id.with_context(lang=partner.lang).description_sale
            else:
                self.name += '\n' + self.product_id.description_sale

        warning = False
        if not pricelist:
            warning = {
                'title': _('No pricelist found.'),
                'message':
                    _('You have to select a pricelist in the Repair form !\n Please set one before choosing a product.')}
            return {'warning': warning}
        else:
            self._onchange_product_uom()

    @api.onchange('product_uom')
    def _onchange_product_uom(self):
        partner = self.repair_id.partner_id
        pricelist = self.repair_id.pricelist_id
        if pricelist and self.product_id:
            price = pricelist.get_product_price(self.product_id, self.product_uom_qty, partner, uom_id=self.product_uom.id)
            if price is False:
                warning = {
                    'title': _('No valid pricelist line found.'),
                    'message':
                        _("Couldn't find a pricelist line matching this product and quantity.\nYou have to change either the product, the quantity or the pricelist.")}
                return {'warning': warning}
            else:
                self.price_unit = price

    def create(self, vals_list):
        res = super().create(vals_list)

        res._sync_sale_order()

        return res

    def write(self, vals):
        res = super().write(vals)

        # TODO Manage change of location, location_dest, qty impact the stock move behind
        self._sync_sale_order(vals)

        return res

    def _sync_sale_order(self, vals=False):
        create_values = []
        for line in self:
            if not line.repair_id.sale_order_id:
                continue
            if line.sale_order_line_ids:
                # TODO : avoid write for nothing ??
                line.sale_order_line_ids.write(self._prepare_sale_order_line_values())
            else:
                create_values.append(self._prepare_sale_order_line_values())
        self.env['sale.order.line'].create(create_values)

    def _prepare_sale_order_line_values(self):
        self.ensure_one()
        res = {
            'name': self.name,
            'product_uom_qty': self.product_uom_qty,
            'product_id': self.product_id.id,
            'product_uom': self.product_uom.id,
            'price_unit': self.price_unit,
            'company_id': self.company_id.id,
            'currency_id': self.currency_id.id,
            'tax_id': self.tax_id.ids,
            'repair_fee_id': self.id,
        }
        if self.repair_id.sale_order_id:
            res['order_id'] = self.repair_id.sale_order_id.id
        return res


class RepairTags(models.Model):
    """ Tags of Repair's tasks """
    _name = "repair.tags"
    _description = "Repair Tags"

    def _get_default_color(self):
        return randint(1, 11)

    name = fields.Char('Tag Name', required=True)
    color = fields.Integer(string='Color Index', default=_get_default_color)

    _sql_constraints = [
        ('name_uniq', 'unique (name)', "Tag name already exists!"),
    ]
