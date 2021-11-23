# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class StockInventoryConflict(models.TransientModel):
    _name = 'stock.inventory.conflict'
    _description = 'Conflict in Inventory'

    inventory_ids = fields.Many2many(
        'stock.inventory', 'stock_conflict_quant_rel', string='Quants')
    inventory_to_fix_ids = fields.Many2many(
        'stock.inventory', string='Conflicts')

    def action_keep_counted_quantity(self):
        for inventory in self.inventory_ids:
            inventory.inventory_diff_quantity = inventory.inventory_quantity - inventory.quantity
        return self.inventory_ids.action_apply_inventory()

    def action_keep_difference(self):
        for inventory in self.inventory_ids:
            inventory.inventory_quantity = inventory.quantity + \
                inventory.inventory_diff_quantity
        return self.inventory_ids.action_apply_inventory()
