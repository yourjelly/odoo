from odoo import models, api, fields, _
from odoo.fields import Datetime


class SafetyStockModel(models.Model):
    _inherit = "stock.warehouse.orderpoint"

    SS1 = fields.Integer(compute="_compute_ss1")

    @api.depends('product_id')
    def _compute_ss1(self):
        for record in self:
            demand_per_time_period = dict()
            for move in record.product_id.stock_move_ids:
                for move_line in move.move_line_ids:
                    if move_line.location_usage in ['internal', 'transit'] \
                            and move_line.location_dest_usage not in ['internal', 'transit']:
                        month_date = Datetime.to_datetime(move_line.date).strftime("%Y%m")
                        if month_date in demand_per_time_period:
                            demand_per_time_period[month_date] = demand_per_time_period[month_date] + move_line.qty_done
                        else:
                            demand_per_time_period[month_date] = move_line.qty_done
            if len(demand_per_time_period) != 0:
                sum_qty = 0.0
                for qty in demand_per_time_period.values():
                    sum_qty += qty
                mean = sum_qty / len(demand_per_time_period)
                record.SS1 = mean
            else:
                record.SS1 = 0.0

    def action_safety_stock_info(self):
        self.ensure_one()
        action = self.env['ir.actions.actions']._for_xml_id('safety_stock.action_safety_stock_info')
        action['name'] = _('Safety stock Information for %s in %s', self.product_id.display_name,
                           self.warehouse_id.display_name)
        res = self.env['safety.stock.info'].create({
            'orderpoint_id': self.id,
        })
        action['res_id'] = res.id
        return action
