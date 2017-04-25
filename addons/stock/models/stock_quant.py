# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from psycopg2 import OperationalError

from odoo import api, fields, models, _
from odoo.exceptions import UserError, ValidationError
from odoo.osv import expression


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
        readonly=True, required=True, oldname='qty')
    reserved_quantity = fields.Float(
        'Quantity',
        default=0.0,
        help='Quantity of reserved products in this quant, in the default unit of measure of the product',
        readonly=True, required=True)
    in_date = fields.Datetime('Incoming Date', index=True, readonly=True)

    @api.multi
    @api.constrains('product_id')
    def check_product_id(self):
        if any(elem.product_id.type == "consu" for elem in self):
            raise ValidationError(_('Quants cannot be created for consumables.'))

    @api.one
    def _compute_name(self):
        self.name = '%s: %s%s' % (self.lot_id.name or self.product_id.code or '',
                                  self.quantity, self.product_id.uom_id.name)

    @api.model
    def _build_where_clause(self, lot_id=None, package_id=None, owner_id=None):
        where_clause = "WHERE product_id=%(product_id)s AND location_id=%(location_id)s "
        if lot_id:
            where_clause += "AND lot_id=%(lot_id)s "
        if package_id:
            where_clause += "AND package_id=%(package_id)s "
        if owner_id:
            where_clause += "AND owner_id=%(owner_id)s "
        return where_clause

    @api.model
    def get_available_quantity(self, product_id, location_id, lot_id=None, package_id=None, owner_id=None):
        # TODO: manually check access rights/rules

        query = "SELECT SUM(quantity) - SUM(reserved_quantity) FROM stock_quant %s"
        query = query % self._build_where_clause(lot_id=lot_id, package_id=package_id, owner_id=owner_id)

        self._cr.execute(query, {
            'product_id': product_id.id,
            'location_id': location_id.id,
            'lot_id': lot_id and lot_id.id,
            'package_id': package_id and package_id.id,
            'owner_id': owner_id and owner_id.id,
        })
        res = self._cr.fetchone()[0]
        if not res:
            return 0.0
        return res

    @api.model
    def increase_available_quantity(self, product_id, location_id, quantity, lot_id=None, package_id=None, owner_id=None):
        query = "SELECT id FROM stock_quant %s"
        query = query % self._build_where_clause(lot_id=lot_id, package_id=package_id, owner_id=owner_id)

        self._cr.execute(query, {
            'product_id': product_id.id,
            'location_id': location_id.id,
            'lot_id': lot_id and lot_id.id,
            'package_id': package_id and package_id.id,
            'owner_id': owner_id and owner_id.id,
        })
        quant_ids = self._cr.fetchall()

        for quant_id in quant_ids:
            try:
                with self._cr.savepoint():
                    self._cr.execute("SELECT 1 FROM stock_quant WHERE id = %s FOR UPDATE NOWAIT", [quant_id], log_exceptions=False)
                    self._cr.execute("UPDATE stock_quant SET quantity=quantity+%s WHERE id=%s", [quantity, quant_id])
                    # TODO: remove the quant if qty==0 & reserved_qty==0
                    break
            except OperationalError, e:
                if e.pgcode == '55P03':  # could not obtain the lock
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
    def decrease_available_quantity(self, product_id, location_id, quantity, lot_id=None, package_id=None, owner_id=None):
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
    def increase_reserved_quantity(self, product_id, location_id, quantity, lot_id=None, package_id=None, owner_id=None):
        # gather the matching quants ordered according to the removal strategy of the product/location
        removal_strategy = self._get_removal_strategy(product_id, location_id)
        removal_strategy_order = self._get_removal_strategy_order(removal_strategy)
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
        quants = self.search(domain, order=removal_strategy_order)

        # loop over them and mark and reserve a maximum
        reserved_quants = []  # list that will contain a tuple (quant, quantity_reserved_or_unreserved)
        available_quantity = self.get_available_quantity(product_id, location_id, lot_id=lot_id, package_id=package_id, owner_id=owner_id)
        for quant in quants:
            if quantity > 0:
                max_quantity_on_quant = quant.quantity - quant.reserved_quantity
                if max_quantity_on_quant <= 0:
                    continue
            else:
                max_quantity_on_quant = quant.reserved_quantity
            max_quantity_on_quant = min(max_quantity_on_quant, quantity)

            quant.reserved_quantity += max_quantity_on_quant
            reserved_quants.append((quant, max_quantity_on_quant))

            quantity -= max_quantity_on_quant
            available_quantity -= max_quantity_on_quant

            if quantity == 0 or available_quantity == 0:
                break
        else:
            vals = {
                'product_id': product_id.id,
                'location_id': location_id.id,
                'lot_id': lot_id and lot_id.id,
                'package_id': package_id and package_id.id,
                'owner_id': owner_id and owner_id.id,
            }
            if quantity > 0:
                vals['quantity'] = 0
                vals['reserved_quantity'] = quantity
            else:
                vals['quantity'] = quantity
                vals['reserved_quantity'] = 0
            quant = self.create(vals)
            reserved_quants.append((quant, quantity))

        return reserved_quants

    @api.model
    def decrease_reserved_quantity(self, product_id, location_id, quantity, lot_id=None, package_id=None, owner_id=None):
        return self.increase_reserved_quantity(product_id, location_id, -quantity, lot_id=lot_id, package_id=package_id, owner_id=owner_id)
