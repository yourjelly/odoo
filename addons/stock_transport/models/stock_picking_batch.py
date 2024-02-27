# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api


class StockPickingBatch(models.Model):
    _inherit = 'stock.picking.batch'

    vehicle_id = fields.Many2one('fleet.vehicle', string="Vehicle")
    vehicle_category_id = fields.Many2one(
        'fleet.vehicle.model.category', string="Vehicle Category")
    dock_id = fields.Many2one('stock.batch.dock', string="Dock")
    vehicle_details = fields.Char(
        "Vehicle Details", compute='_compute_vehicle_details')
    max_weight = fields.Float(string="Max Weight (Kg)",
                              related='vehicle_category_id.max_weight')
    max_volume = fields.Float(string="Max Volume (m³)",
                              related='vehicle_category_id.max_volume')
    driver_id = fields.Many2one(
        related="vehicle_id.driver_id", string="Driver")
    used_weight_percentage = fields.Float(
        string="Weight", compute='_compute_used_weight_percentage', store=True)
    used_volume_percentage = fields.Float(
        string="Volume", compute='_compute_used_volume_percentage', store=True)
    end_date = fields.Datetime(
        'End Date', default=lambda self: fields.Datetime.now())
    dock_info = fields.Char(string="Dock Information",
                            compute='_compute_dock_info', store=True)
    batch_properties = fields.Properties(
        'Properties',
        definition='picking_type_id.picking_properties_definition')

    @api.depends('vehicle_id', 'max_weight', 'max_volume')
    def _compute_vehicle_details(self):
        for record in self:
            vehicle_details = []
            if record.vehicle_id:
                vehicle_details.append(record.vehicle_id.name)
            vehicle_details.append(f"{record.max_weight}Kg") if record.max_weight else vehicle_details.append("0Kg")
            vehicle_details.append(f"{record.max_volume}m³") if record.max_volume else vehicle_details.append("0m³")
            record.vehicle_details = ', '.join(vehicle_details)

    @api.depends('picking_ids.max_weight', 'vehicle_category_id.max_weight')
    def _compute_used_weight_percentage(self):
        for batch in self:
            total_picking_weight = sum(picking.max_weight for picking in batch.picking_ids)
            batch_vehicle_max_weight = batch.vehicle_category_id.max_weight
            used_weight_percentage = 100 * (total_picking_weight / batch_vehicle_max_weight) if batch_vehicle_max_weight else 0.0
            batch.used_weight_percentage = used_weight_percentage

    @api.depends('picking_ids.max_volume', 'vehicle_category_id.max_volume')
    def _compute_used_volume_percentage(self):
        for batch in self:
            total_picking_volume = sum(picking.max_volume for picking in batch.picking_ids)
            batch_vehicle_max_volume = batch.vehicle_category_id.max_volume
            used_volume_percentage = 100 * (total_picking_volume / batch_vehicle_max_volume) if batch_vehicle_max_volume else 0.0
            batch.used_volume_percentage = used_volume_percentage


    @api.depends('dock_id', 'max_weight', 'max_volume')
    def _compute_dock_info(self):
        for record in self:
            dock_name = f"{record.dock_id.name}: " if record.dock_id else ''
            max_weight = f"{record.max_weight}kg" if record.max_weight else '0Kg'
            max_volume = f"{record.max_volume}m³" if record.max_volume else '0m³'
            dock_info_str = f"{dock_name}{max_weight}, {max_volume}".rstrip(', ')
            record.dock_info = dock_info_str

    @api.onchange('vehicle_id')
    def _onchange_vehicle_id(self):
        self.vehicle_category_id = self.vehicle_id.category_id if self.vehicle_id else False

    def action_map_delivery_batch(self):
        action = {
            'type': 'ir.actions.act_window',
            'name': 'All Deliveries',
            'res_model': 'stock.picking',
            'view_mode': 'map',
            'domain': [('id', 'in', self.picking_ids.ids)],
        }
        return action
