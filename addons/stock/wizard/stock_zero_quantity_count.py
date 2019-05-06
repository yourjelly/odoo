from odoo import api, models, fields, tools

class StockZeroQuantityCount(models.TransientModel):
    _name = 'stock.zero.quantity.count'
    _description = 'Stock Zero Quantity Count'

    inventory_lines = fields.Many2many('stock.inventory.line', index=True, required=True)

    def action_zero_quantity_count(self):
        inventory = self.env['stock.inventory'].create({'name': 'Test zero quantity count'})
        self.inventory_lines.write({ 'inventory_id': inventory.id })
        inventory.action_validate()
        return
