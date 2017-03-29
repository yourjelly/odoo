# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from psycopg2 import OperationalError

from odoo import api, fields, models, _
from odoo.exceptions import UserError
from odoo.osv import expression
from odoo.tools.float_utils import float_is_zero, float_round


class StockQuant(models.Model):
    _name = 'stock.quant'
    _description = 'Quants'

    product_id = fields.Many2one(
        'product.product', 'Product',
        ondelete='restrict', readonly=True, required=True)
    product_uom_id = fields.Many2one(
        'product.uom', 'Unit of Measure',
        readonly=True, related='product_id.uom_id')
    company_id = fields.Many2one(
        'res.company', 'Company',
        default=lambda self: self.env['res.company']._company_default_get('stock.quant'),
        help='The company to which the quants belong',
        readonly=True, required=True)
    location_id = fields.Many2one(
        'stock.location', 'Location',
        auto_join=True, ondelete='restrict', readonly=True, required=True)
    lot_id = fields.Many2one(
        'stock.production.lot', 'Lot/Serial Number',
        ondelete='restrict', readonly=True)
    package_id = fields.Many2one(
        'stock.quant.package', 'Package',
        help='The package containing this quant', readonly=True)
    owner_id = fields.Many2one(
        'res.partner', 'Owner',
        help='This is the owner of the quant', readonly=True)
    quantity = fields.Float(
        'Quantity',
        help='Quantity of products in this quant, in the default unit of measure of the product',
        readonly=True, required=True) #old_name=qty?
    reserved_quantity = fields.Float(
        'Quantity',
        default=0.0,
        help='Quantity of reserved products in this quant, in the default unit of measure of the product',
        readonly=True, required=True)
    in_date = fields.Datetime('Incoming Date', index=True, readonly=True)

    @api.one
    def _compute_name(self):
        self.name = '%s: %s%s' % (self.lot_id.name or self.product_id.code or '',
                                  self.quantity, self.product_id.uom_id.name)

    @api.model
    def _gather(self, product_id, location_id, lot_id=False, package_id=False, owner_id=False, order=None):
        domain = [
            ('product_id', '=', product_id.id),
            ('location_id', 'child_of', location_id.id),
        ]
        if lot_id:
            domain = expression.AND([[('lot_id', '=', lot_id.id)], domain])
        if package_id:
            domain = expression.AND([[('package_id', '=', package_id.id)], domain])
        if owner_id:
            domain = expression.AND([[('owner_id', '=', owner_id.id)], domain])
        return self.search(domain, order=order)

    @api.model
    def get_available_quantity(self, product_id, location_id, lot_id=False, package_id=False, owner_id=False):
        quants = self._gather(product_id, location_id, lot_id=lot_id, package_id=package_id, owner_id=owner_id)
        return sum(quants.mapped('quantity')) - sum(quants.mapped('reserved_quantity'))

    @api.model
    def increase_available_quantity(self, product_id, location_id, quantity, lot_id=False, package_id=False, owner_id=False):
        quants = self._gather(product_id, location_id, lot_id=lot_id, package_id=package_id, owner_id=owner_id)
        for quant in quants:
            quant.quantity += quantity
            break
            try:
                cr2 = self.env.registry.cursor()
                cr2.execute("SELECT 1 FROM stock_quant WHERE id = %s FOR UPDATE NOWAIT", [quant.id])
                quant.quantity += quantity
                cr2.close()
                break
            except OperationalError, e:
                if e.pgcode == '55P03':  # could not obtain the lock
                    cr2.rollback()
                    cr2.close()
                    continue
                else:
                    raise
        else:
            self.create({
                'product_id': product_id.id,
                'location_id': location_id.id,
                'quantity': quantity,
                'lot_id': lot_id and lot_id.id,
                'package_id': package_id and package_id.id,
                'owner_id': owner_id and owner_id.id,
            })

    @api.model
    def decrease_available_quantity(self, product_id, location_id, quantity, lot_id=False, package_id=False, owner_id=False):
        self.increase_available_quantity(product_id, location_id, -quantity, lot_id=lot_id, package_id=package_id, owner_id=owner_id)

    @api.model
    def _get_removal_strategy(self, product_id, location_id):
        if product_id.categ_id.removal_strategy_id:
            return self.product_id.categ_id.removal_strategy_id.method
        loc = location_id
        while loc:
            if loc.removal_strategy_id:
                return loc.removal_strategy_id.method
            loc = loc.location_id
        return 'fifo'

    @api.model
    def _get_removal_strategy_order(self, removal_strategy):
        if removal_strategy == 'fifo':
            return 'in_date, id'
        elif removal_strategy == 'lifo':
            return 'in_date desc, id desc'
        raise UserError(_('Removal strategy %s not implemented.') % (removal_strategy,))

    @api.model
    def increase_reserved_quantity(self, product_id, location_id, quantity, lot_id=False, package_id=False, owner_id=False):
        # gather the matching quants ordered according to the removal strategy of the product/location
        removal_strategy = self._get_removal_strategy(product_id, location_id)
        removal_strategy_order = self._get_removal_strategy_order(removal_strategy)
        quants = self._gather(product_id, location_id, lot_id=lot_id, package_id=package_id, owner_id=owner_id,
                              order=removal_strategy_order)

        # loop over them and mark and reserve a maximum
        reserved_quants = []
        quantity_to_reserve_global = quantity
        available_quantity = self.get_available_quantity(product_id, location_id, lot_id=lot_id,
                                                         package_id=package_id, owner_id=owner_id)

        for quant in quants:
            max_reservable_quantity = quant.quantity - quant.reserved_quantity

            if max_reservable_quantity <= 0:
                continue

            quantity_to_reserve = min(max_reservable_quantity, quantity_to_reserve_global)

            quant.reserved_quantity += quantity_to_reserve
            reserved_quants.append((quant, quantity_to_reserve))

            quantity_to_reserve_global -= quantity_to_reserve
            available_quantity -= quantity_to_reserve

            if quantity_to_reserve == 0 or available_quantity == 0:
                break

        return reserved_quants

    @api.model
    def decrease_reserved_quantity(self, product_id, location_id, quantity, lot_id=False, package_id=False, owner_id=False):
        return self.increase_reserved_quantity(product_id, location_id, -quantity, lot_id=lot_id,
                                                package_id=package_id, owner_id=owner_id)

    @api.multi        
    def unlink(self):
        # access rules already limit this to admin         
        if not self.env.context.get('force_unlink'):
            raise UserError(_('Under no circumstances should you delete or change quants yourselves!'))
        return super(StockQuant, self).unlink()