# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging

from psycopg2 import Error

from odoo import _, api, fields, models
from odoo.exceptions import UserError, ValidationError
from odoo.osv import expression
from odoo.tools import groupby
from odoo.tools.float_utils import float_compare, float_is_zero

_logger = logging.getLogger(__name__)


class StockQuant(models.Model):
    _name = 'stock.quant'
    _description = 'Quants'
    _rec_name = 'product_id'

    product_id = fields.Many2one(
        'product.product', 'Product',
        ondelete='restrict', required=True, index=True, check_company=True)
    product_tmpl_id = fields.Many2one(
        'product.template', string='Product Template',
        related='product_id.product_tmpl_id')
    product_uom_id = fields.Many2one(
        'uom.uom', 'Unit of Measure',
        readonly=True, related='product_id.uom_id')
    company_id = fields.Many2one(related='location_id.company_id', string='Company', store=True, readonly=True)
    location_id = fields.Many2one(
        'stock.location', 'Location',
        auto_join=True, ondelete='restrict', required=True, index=True, check_company=True)
    lot_id = fields.Many2one(
        'stock.production.lot', 'Lot/Serial Number', index=True,
        ondelete='restrict', check_company=True)
    package_id = fields.Many2one(
        'stock.quant.package', 'Package',
        domain="[('location_id', '=', location_id)]",
        help='The package containing this quant', ondelete='restrict', check_company=True)
    owner_id = fields.Many2one(
        'res.partner', 'Owner',
        help='This is the owner of the quant', check_company=True)
    quantity = fields.Float(
        'Quantity',
        help='Quantity of products in this quant, in the default unit of measure of the product',
        readonly=True)
    reserved_quantity = fields.Float(
        'Reserved Quantity',
        default=0.0,
        help='Quantity of reserved products in this quant, in the default unit of measure of the product',
        readonly=True, required=True)
    available_quantity = fields.Float(
        'Available Quantity',
        help="On hand quantity which hasn't been reserved on a transfer, in the default unit of measure of the product",
        compute='_compute_available_quantity')
    in_date = fields.Datetime('Incoming Date', readonly=True, required=True, default=fields.Datetime.now)
    tracking = fields.Selection(related='product_id.tracking', readonly=True)
    on_hand = fields.Boolean('On Hand', store=False, search='_search_on_hand')
    product_categ_id = fields.Many2one(related='product_tmpl_id.categ_id')
    inventory_ids = fields.One2many('stock.inventory', 'quant_id', 'Inventory')

    @api.depends('quantity', 'reserved_quantity')
    def _compute_available_quantity(self):
        for quant in self:
            quant.available_quantity = quant.quantity - quant.reserved_quantity

    def _search_on_hand(self, operator, value):
        """Handle the "on_hand" filter, indirectly calling `_get_domain_locations`."""
        if operator not in ['=', '!='] or not isinstance(value, bool):
            raise UserError(_('Operation not supported'))
        domain_loc = self.env['product.product']._get_domain_locations()[0]
        quant_query = self.env['stock.quant']._search(domain_loc)
        if (operator == '!=' and value is True) or (operator == '=' and value is False):
            domain_operator = 'not in'
        else:
            domain_operator = 'in'
        return [('id', domain_operator, quant_query)]

    def _load_records_create(self, values):
        """ Add default location if import file did not fill it"""
        company_user = self.env.company
        warehouse = self.env['stock.warehouse'].search([('company_id', '=', company_user.id)], limit=1)
        for value in values:
            if 'location_id' not in value:
                value['location_id'] = warehouse.lot_stock_id.id
        return super()._load_records_create(values)

    @api.model
    def read_group(self, domain, fields, groupby, offset=0, limit=None, orderby=False, lazy=True):
        """ Override to compute the sum of the `available_quantity` field.
        """
        if 'available_quantity' in fields:
            if 'quantity' not in fields:
                fields.append('quantity')
            if 'reserved_quantity' not in fields:
                fields.append('reserved_quantity')
        result = super(StockQuant, self).read_group(domain, fields, groupby, offset=offset, limit=limit, orderby=orderby, lazy=lazy)
        for group in result:
            if 'available_quantity' in fields:
                group['available_quantity'] = group['quantity'] - group['reserved_quantity']
        return result

    def action_view_stock_moves(self):
        self.ensure_one()
        action = self.env["ir.actions.actions"]._for_xml_id("stock.stock_move_line_action")
        action['domain'] = [
            ('product_id', '=', self.product_id.id),
            '|',
                ('location_id', '=', self.location_id.id),
                ('location_dest_id', '=', self.location_id.id),
            ('lot_id', '=', self.lot_id.id),
            '|',
                ('package_id', '=', self.package_id.id),
                ('result_package_id', '=', self.package_id.id),
        ]
        return action

    @api.constrains('product_id')
    def check_product_id(self):
        if any(elem.product_id.type != 'product' for elem in self):
            raise ValidationError(_('Quants cannot be created for consumables or services.'))

    @api.constrains('quantity')
    def check_quantity(self):
        for quant in self:
            if quant.location_id.usage != 'inventory' and quant.lot_id and quant.product_id.tracking == 'serial' \
                    and float_compare(abs(quant.quantity), 1, precision_rounding=quant.product_uom_id.rounding) > 0:
                raise ValidationError(_('The serial number has already been assigned: \n Product: %s, Serial Number: %s') % (quant.product_id.display_name, quant.lot_id.name))

    @api.constrains('location_id')
    def check_location_id(self):
        for quant in self:
            if quant.location_id.usage == 'view':
                raise ValidationError(_('You cannot take products from or deliver products to a location of type "view" (%s).') % quant.location_id.name)

    @api.model
    def _get_removal_strategy(self, product_id, location_id):
        if product_id.categ_id.removal_strategy_id:
            return product_id.categ_id.removal_strategy_id.method
        loc = location_id
        while loc:
            if loc.removal_strategy_id:
                return loc.removal_strategy_id.method
            loc = loc.location_id
        return 'fifo'

    @api.model
    def _get_removal_strategy_order(self, removal_strategy):
        if removal_strategy == 'fifo':
            return 'in_date ASC, id'
        elif removal_strategy == 'lifo':
            return 'in_date DESC, id DESC'
        elif removal_strategy == 'closest':
            return 'location_id ASC, id DESC'
        raise UserError(_('Removal strategy %s not implemented.') % (removal_strategy,))

    def _gather(self, product_id, location_id, lot_id=None, package_id=None, owner_id=None, strict=False):
        removal_strategy = self._get_removal_strategy(product_id, location_id)
        removal_strategy_order = self._get_removal_strategy_order(removal_strategy)

        domain = [('product_id', '=', product_id.id)]
        if not strict:
            if lot_id:
                domain = expression.AND([[('lot_id', '=', lot_id.id)], domain])
            if package_id:
                domain = expression.AND([[('package_id', '=', package_id.id)], domain])
            if owner_id:
                domain = expression.AND([[('owner_id', '=', owner_id.id)], domain])
            domain = expression.AND([[('location_id', 'child_of', location_id.id)], domain])
        else:
            domain = expression.AND([[('lot_id', '=', lot_id and lot_id.id or False)], domain])
            domain = expression.AND([[('package_id', '=', package_id and package_id.id or False)], domain])
            domain = expression.AND([[('owner_id', '=', owner_id and owner_id.id or False)], domain])
            domain = expression.AND([[('location_id', '=', location_id.id)], domain])

        return self.search(domain, order=removal_strategy_order)

    @api.model
    def _get_available_quantity(self, product_id, location_id, lot_id=None, package_id=None, owner_id=None, strict=False, allow_negative=False):
        """ Return the available quantity, i.e. the sum of `quantity` minus the sum of
        `reserved_quantity`, for the set of quants sharing the combination of `product_id,
        location_id` if `strict` is set to False or sharing the *exact same characteristics*
        otherwise.
        This method is called in the following usecases:
            - when a stock move checks its availability
            - when a stock move actually assign
            - when editing a move line, to check if the new value is forced or not
            - when validating a move line with some forced values and have to potentially unlink an
              equivalent move line in another picking
        In the two first usecases, `strict` should be set to `False`, as we don't know what exact
        quants we'll reserve, and the characteristics are meaningless in this context.
        In the last ones, `strict` should be set to `True`, as we work on a specific set of
        characteristics.

        :return: available quantity as a float
        """
        self = self.sudo()
        quants = self._gather(product_id, location_id, lot_id=lot_id, package_id=package_id, owner_id=owner_id, strict=strict)
        rounding = product_id.uom_id.rounding
        if product_id.tracking == 'none':
            available_quantity = sum(quants.mapped('quantity')) - sum(quants.mapped('reserved_quantity'))
            if allow_negative:
                return available_quantity
            else:
                return available_quantity if float_compare(available_quantity, 0.0, precision_rounding=rounding) >= 0.0 else 0.0
        else:
            availaible_quantities = {lot_id: 0.0 for lot_id in list(set(quants.mapped('lot_id'))) + ['untracked']}
            for quant in quants:
                if not quant.lot_id:
                    availaible_quantities['untracked'] += quant.quantity - quant.reserved_quantity
                else:
                    availaible_quantities[quant.lot_id] += quant.quantity - quant.reserved_quantity
            if allow_negative:
                return sum(availaible_quantities.values())
            else:
                return sum([available_quantity for available_quantity in availaible_quantities.values() if float_compare(available_quantity, 0, precision_rounding=rounding) > 0])

    @api.model
    def _update_available_quantity(self, product_id, location_id, quantity, lot_id=None, package_id=None, owner_id=None, in_date=None):
        """ Increase or decrease `reserved_quantity` of a set of quants for a given set of
        product_id/location_id/lot_id/package_id/owner_id.

        :param product_id:
        :param location_id:
        :param quantity:
        :param lot_id:
        :param package_id:
        :param owner_id:
        :param datetime in_date: Should only be passed when calls to this method are done in
                                 order to move a quant. When creating a tracked quant, the
                                 current datetime will be used.
        :return: tuple (available_quantity, in_date as a datetime)
        """
        self = self.sudo()
        quants = self._gather(product_id, location_id, lot_id=lot_id, package_id=package_id, owner_id=owner_id, strict=True)

        incoming_dates = [d for d in quants.mapped('in_date') if d]
        if in_date:
            incoming_dates += [in_date]
        # If multiple incoming dates are available for a given lot_id/package_id/owner_id, we
        # consider only the oldest one as being relevant.
        if incoming_dates:
            in_date = min(incoming_dates)
        else:
            in_date = fields.Datetime.now()

        quant = None
        if quants:
            # see _acquire_one_job for explanations
            self._cr.execute("SELECT id FROM stock_quant WHERE id IN %s LIMIT 1 FOR NO KEY UPDATE SKIP LOCKED", [tuple(quants.ids)])
            stock_quant_result = self._cr.fetchone()
            if stock_quant_result:
                quant = self.browse(stock_quant_result[0])

        if quant:
            quant.write({
                'quantity': quant.quantity + quantity,
                'in_date': in_date,
            })
        else:
            self.create({
                'product_id': product_id.id,
                'location_id': location_id.id,
                'quantity': quantity,
                'lot_id': lot_id and lot_id.id,
                'package_id': package_id and package_id.id,
                'owner_id': owner_id and owner_id.id,
                'in_date': in_date,
            })
        return self._get_available_quantity(product_id, location_id, lot_id=lot_id, package_id=package_id, owner_id=owner_id, strict=False, allow_negative=True), in_date

    @api.model
    def _update_reserved_quantity(self, product_id, location_id, quantity, lot_id=None, package_id=None, owner_id=None, strict=False):
        """ Increase the reserved quantity, i.e. increase `reserved_quantity` for the set of quants
        sharing the combination of `product_id, location_id` if `strict` is set to False or sharing
        the *exact same characteristics* otherwise. Typically, this method is called when reserving
        a move or updating a reserved move line. When reserving a chained move, the strict flag
        should be enabled (to reserve exactly what was brought). When the move is MTS,it could take
        anything from the stock, so we disable the flag. When editing a move line, we naturally
        enable the flag, to reflect the reservation according to the edition.

        :return: a list of tuples (quant, quantity_reserved) showing on which quant the reservation
            was done and how much the system was able to reserve on it
        """
        self = self.sudo()
        rounding = product_id.uom_id.rounding
        quants = self._gather(product_id, location_id, lot_id=lot_id, package_id=package_id, owner_id=owner_id, strict=strict)
        reserved_quants = []

        if float_compare(quantity, 0, precision_rounding=rounding) > 0:
            # if we want to reserve
            available_quantity = self._get_available_quantity(product_id, location_id, lot_id=lot_id, package_id=package_id, owner_id=owner_id, strict=strict)
            if float_compare(quantity, available_quantity, precision_rounding=rounding) > 0:
                raise UserError(_('It is not possible to reserve more products of %s than you have in stock.', product_id.display_name))
        elif float_compare(quantity, 0, precision_rounding=rounding) < 0:
            # if we want to unreserve
            available_quantity = sum(quants.mapped('reserved_quantity'))
            if float_compare(abs(quantity), available_quantity, precision_rounding=rounding) > 0:
                raise UserError(_('It is not possible to unreserve more products of %s than you have in stock.', product_id.display_name))
        else:
            return reserved_quants

        for quant in quants:
            if float_compare(quantity, 0, precision_rounding=rounding) > 0:
                max_quantity_on_quant = quant.quantity - quant.reserved_quantity
                if float_compare(max_quantity_on_quant, 0, precision_rounding=rounding) <= 0:
                    continue
                max_quantity_on_quant = min(max_quantity_on_quant, quantity)
                quant.reserved_quantity += max_quantity_on_quant
                reserved_quants.append((quant, max_quantity_on_quant))
                quantity -= max_quantity_on_quant
                available_quantity -= max_quantity_on_quant
            else:
                max_quantity_on_quant = min(quant.reserved_quantity, abs(quantity))
                quant.reserved_quantity -= max_quantity_on_quant
                reserved_quants.append((quant, -max_quantity_on_quant))
                quantity += max_quantity_on_quant
                available_quantity += max_quantity_on_quant

            if float_is_zero(quantity, precision_rounding=rounding) or float_is_zero(available_quantity, precision_rounding=rounding):
                break
        return reserved_quants

    @api.model
    def _unlink_zero_quants(self):
        """ _update_available_quantity may leave quants with no
        quantity and no reserved_quantity. It used to directly unlink
        these zero quants but this proved to hurt the performance as
        this method is often called in batch and each unlink invalidate
        the cache. We defer the calls to unlink in this method.
        """
        precision_digits = max(6, self.sudo().env.ref('product.decimal_product_uom').digits * 2)
        # Use a select instead of ORM search for UoM robustness.
        query = """
        SELECT q.id
        FROM stock_quant q
        LEFT JOIN stock_inventory i
        ON q.id = i.quant_id
        WHERE (round(q.quantity::numeric, %s) = 0 OR q.quantity IS NULL)
            AND round(q.reserved_quantity::numeric, %s) = 0
            AND (round(i.inventory_quantity::numeric, %s) = 0 OR i.inventory_quantity IS NULL)
            AND i.user_id IS NULL;"""
        params = (precision_digits, precision_digits, precision_digits)
        self.env.cr.execute(query, params)
        quant_ids = self.env['stock.quant'].browse([quant['id'] for quant in self.env.cr.dictfetchall()])
        quant_ids.sudo().unlink()

    @api.model
    def _merge_quants(self):
        """ In a situation where one transaction is updating a quant via
        `_update_available_quantity` and another concurrent one calls this function with the same
        argument, we’ll create a new quant in order for these transactions to not rollback. This
        method will find and deduplicate these quants.
        """
        query = """
        SELECT
            MIN(q.id) as to_update_quant_id,
            (array_agg(q.id ORDER BY q.id))[2:array_length(array_agg(q.id), 1)] as to_delete_quant_ids,
            SUM(q.reserved_quantity) as reserved_quantity,
            SUM(q.quantity) as quantity,
            MIN(q.in_date) as in_date
        FROM stock_quant q
        LEFT JOIN stock_inventory i
        ON i.quant_id = q.id
        GROUP BY q.product_id, q.company_id, q.location_id, q.lot_id, q.package_id, q.owner_id
        HAVING count(q.id) > 1;
        """

        try:
            with self.env.cr.savepoint():
                self.env.cr.execute(query)
                duplicate_quants = self.env.cr.fetchall()
                quants_to_delete = set()
                for (quant_to_update_id, quants_to_delete_ids, reserved_qty, qty, in_date) in duplicate_quants:
                    self.env['stock.quant'].browse(quant_to_update_id).write({
                        'quantity': qty,
                        'reserved_quantity': reserved_qty,
                        'in_date': in_date
                    })
                    inventories = self.env['stock.quant'].browse(
                        quants_to_delete_ids).inventory_ids
                    inventories.write({'quant_id': quant_to_update_id})
                    quants_to_delete.update(set(quants_to_delete_ids))
                self.env['stock.quant'].browse(quants_to_delete).unlink()
                self.invalidate_cache()
        except Error as e:
            _logger.info('an error occured while merging quants: %s', e.pgerror)
        finally:
            self.env.cr.execute("""DROP TABLE IF EXISTS dupes""")

    @api.model
    def _quant_tasks(self):
        self._merge_quants()
        self._unlink_zero_quants()

    @api.model
    def _check_serial_number(self, product_id, lot_id, company_id, source_location_id=None, ref_doc_location_id=None):
        """ Checks for duplicate serial numbers (SN) when assigning a SN (i.e. no source_location_id)
        and checks for potential incorrect location selection of a SN when using a SN (i.e.
        source_location_id). Returns warning message of all locations the SN is located at and
        (optionally) a recommended source location of the SN (when using SN from incorrect location).
        This function is designed to be used by onchange functions across differing situations including,
        but not limited to scrap, incoming picking SN encoding, and outgoing picking SN selection.

        :param product_id: `product.product` product to check SN for
        :param lot_id: `stock.production.lot` SN to check
        :param company_id: `res.company` company to check against (i.e. we ignore duplicate SNs across
            different companies)
        :param source_location_id: `stock.location` optional source location if using the SN rather
            than assigning it
        :param ref_doc_location_id: `stock.location` optional reference document location for
            determining recommended location. This is param expected to only be used when a
            `source_location_id` is provided.
        :return: tuple(message, recommended_location) If not None, message is a string expected to be
            used in warning message dict and recommended_location is a `location_id`
        """
        message = None
        recommended_location = None
        if product_id.tracking == 'serial':
            quants = self.env['stock.quant'].search([('product_id', '=', product_id.id),
                                                         ('lot_id', '=', lot_id.id),
                                                         ('quantity', '!=', 0),
                                                         '|', ('location_id.usage', '=', 'customer'),
                                                              '&', ('company_id', '=', company_id.id),
                                                                   ('location_id.usage', 'in', ('internal', 'transit'))])
            sn_locations = quants.mapped('location_id')
            if quants:
                if not source_location_id:
                    # trying to assign an already existing SN
                    message =  _('The Serial Number (%s) is already used in these location(s): %s.\n\n'
                                 'Is this expected? For example this can occur if a delivery operation is validated '
                                 'before its corresponding receipt operation is validated. In this case the issue will be solved '
                                 'automatically once all steps are completed. Otherwise, the serial number should be corrected to '
                                 'prevent inconsistent data.',
                                 lot_id.name, ', '.join(sn_locations.mapped('display_name')))

                elif source_location_id and source_location_id not in sn_locations:
                    # using an existing SN in the wrong location
                    recommended_location = self.env['stock.location']
                    if ref_doc_location_id:
                        for location in sn_locations:
                            if ref_doc_location_id.parent_path in location.parent_path:
                                recommended_location = location
                                break
                    else:
                        for location in sn_locations:
                            if location.usage != 'customer':
                                recommended_location = location
                                break
                    if recommended_location:
                        message = _('Serial number (%s) is not located in %s, but is located in location(s): %s.\n\n'
                                    'Source location for this move will be changed to %s',
                                    lot_id.name, source_location_id.display_name, ', '.join(sn_locations.mapped('display_name')), recommended_location.display_name)
                    else:
                        message = _('Serial number (%s) is not located in %s, but is located in location(s): %s.\n\n'
                                    'Please correct this to prevent inconsistent data.',
                                    lot_id.name, source_location_id.display_name, ', '.join(sn_locations.mapped('display_name')))
        return message, recommended_location


class QuantPackage(models.Model):
    """ Packages containing quants and/or other packages """
    _name = "stock.quant.package"
    _description = "Packages"
    _order = 'name'

    name = fields.Char(
        'Package Reference', copy=False, index=True,
        default=lambda self: self.env['ir.sequence'].next_by_code('stock.quant.package') or _('Unknown Pack'))
    quant_ids = fields.One2many('stock.quant', 'package_id', 'Bulk Content', readonly=True,
        domain=['|', ('quantity', '!=', 0), ('reserved_quantity', '!=', 0)])
    package_type_id = fields.Many2one(
        'stock.package.type', 'Package Type', index=True, check_company=True)
    location_id = fields.Many2one(
        'stock.location', 'Location', compute='_compute_package_info',
        index=True, readonly=True, store=True)
    company_id = fields.Many2one(
        'res.company', 'Company', compute='_compute_package_info',
        index=True, readonly=True, store=True)
    owner_id = fields.Many2one(
        'res.partner', 'Owner', compute='_compute_package_info', search='_search_owner',
        index=True, readonly=True, compute_sudo=True)
    package_use = fields.Selection([
        ('disposable', 'Disposable Box'),
        ('reusable', 'Reusable Box'),
        ], string='Package Use', default='disposable', required=True,
        help="""Reusable boxes are used for batch picking and emptied afterwards to be reused. In the barcode application, scanning a reusable box will add the products in this box.
        Disposable boxes aren't reused, when scanning a disposable box in the barcode application, the contained products are added to the transfer.""")

    @api.depends('quant_ids.package_id', 'quant_ids.location_id', 'quant_ids.company_id', 'quant_ids.owner_id', 'quant_ids.quantity', 'quant_ids.reserved_quantity')
    def _compute_package_info(self):
        for package in self:
            values = {'location_id': False, 'owner_id': False}
            if package.quant_ids:
                values['location_id'] = package.quant_ids[0].location_id
                if all(q.owner_id == package.quant_ids[0].owner_id for q in package.quant_ids):
                    values['owner_id'] = package.quant_ids[0].owner_id
                if all(q.company_id == package.quant_ids[0].company_id for q in package.quant_ids):
                    values['company_id'] = package.quant_ids[0].company_id
            package.location_id = values['location_id']
            package.company_id = values.get('company_id')
            package.owner_id = values['owner_id']

    def _search_owner(self, operator, value):
        if value:
            packs = self.search([('quant_ids.owner_id', operator, value)])
        else:
            packs = self.search([('quant_ids', operator, value)])
        if packs:
            return [('id', 'parent_of', packs.ids)]
        else:
            return [('id', '=', False)]

    def unpack(self):
        for package in self:
            move_line_to_modify = self.env['stock.move.line'].search([
                ('package_id', '=', package.id),
                ('state', 'in', ('assigned', 'partially_available')),
                ('product_qty', '!=', 0),
            ])
            move_line_to_modify.write({'package_id': False})
            package.mapped('quant_ids').sudo().write({'package_id': False})

        # Quant clean-up, mostly to avoid multiple quants of the same product. For example, unpack
        # 2 packages of 50, then reserve 100 => a quant of -50 is created at transfer validation.
        self.env['stock.quant']._quant_tasks()

    def action_view_picking(self):
        action = self.env["ir.actions.actions"]._for_xml_id("stock.action_picking_tree_all")
        domain = ['|', ('result_package_id', 'in', self.ids), ('package_id', 'in', self.ids)]
        pickings = self.env['stock.move.line'].search(domain).mapped('picking_id')
        action['domain'] = [('id', 'in', pickings.ids)]
        return action

    def _check_move_lines_map_quant(self, move_lines, field):
        """ This method checks that all product (quants) of self (package) are well present in the `move_line_ids`. """
        precision_digits = self.env['decimal.precision'].precision_get('Product Unit of Measure')

        def _keys_groupby(record):
            return record.product_id, record.lot_id

        grouped_quants = {}
        for k, g in groupby(self.quant_ids, key=_keys_groupby):
            grouped_quants[k] = sum(self.env['stock.quant'].concat(*g).mapped('quantity'))

        grouped_ops = {}
        for k, g in groupby(move_lines, key=_keys_groupby):
            grouped_ops[k] = sum(self.env['stock.move.line'].concat(*g).mapped(field))

        if any(not float_is_zero(grouped_quants.get(key, 0) - grouped_ops.get(key, 0), precision_digits=precision_digits) for key in grouped_quants) \
                or any(not float_is_zero(grouped_ops.get(key, 0) - grouped_quants.get(key, 0), precision_digits=precision_digits) for key in grouped_ops):
            return False
        return True
