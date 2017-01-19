# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _

from odoo.addons import decimal_precision as dp
from odoo.exceptions import UserError, ValidationError
from odoo.tools.float_utils import float_round, float_compare


class StockMoveLot(models.Model): # from MRP
    _name = "stock.move.lot"
    _description = "Lot/Serial number for pack ops"

    move_id = fields.Many2one('stock.move')
    qty = fields.Float('Done', default=1.0)
    lot_id = fields.Many2one('stock.production.lot', 'Lot/Serial Number')
    lot_name = fields.Char('Lot/Serial Number')
    qty_todo = fields.Float('To Do', default=0.0)
    plus_visible = fields.Boolean(compute='_compute_plus_visible', default=True)

    _sql_constraints = [
        ('qty', 'CHECK(qty >= 0.0)', 'Quantity must be greater than or equal to 0.0!'),
        ('uniq_lot_id', 'unique(operation_id, lot_id)', 'You have already mentioned this lot in another line'),
        ('uniq_lot_name', 'unique(operation_id, lot_name)', 'You have already mentioned this lot name in another line')]

    @api.one
    def _compute_plus_visible(self):
        if self.operation_id.product_id.tracking == 'serial':
            self.plus_visible = (self.qty == 0.0)
        else:
            self.plus_visible = (self.qty_todo == 0.0) or (self.qty < self.qty_todo)

    @api.constrains('lot_id', 'lot_name')
    def _check_lot(self):
        if any(not lot.lot_name and not lot.lot_id for lot in self):
            raise ValidationError(_('Lot/Serial Number required'))
        return True

    def action_add_quantity(self, quantity):
        for lot in self:
            lot.write({'qty': lot.qty + quantity})
            lot.operation_id.write({'qty_done': sum(operation_lot.qty for operation_lot in lot.operation_id.pack_lot_ids)})
        return self.mapped('operation_id').action_split_lots()

    @api.multi
    def do_plus(self):
        return self.action_add_quantity(1)

    @api.multi
    def do_minus(self):
        return self.action_add_quantity(-1)

