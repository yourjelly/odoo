import statistics

from odoo import models, api, fields, _
from odoo.fields import Datetime
from datetime import datetime


class SafetyStockModel(models.Model):
    _inherit = "stock.warehouse.orderpoint"

    mean_sales = fields.Float(compute="_compute_stats_sales")  # mean nb sales per day
    mean_lead_time = fields.Float(compute="_compute_stats_lead_time")  # mean lead time in day
    max_sales = fields.Integer(compute="_compute_stats_sales")  # max nb sales in one day
    max_lead_time = fields.Integer(compute="_compute_stats_lead_time")  # max lead time in day
    variance_sales = fields.Float(compute="_compute_stats_sales")  # variance of sales
    variance_lead_time = fields.Float(compute="_compute_stats_lead_time")  # variance of lead time

    @api.depends('product_id.stock_move_ids')
    def _compute_stats_sales(self):
        for record in self:
            demand_per_time_period = dict()
            min_date = datetime.max
            # max_date = datetime.min
            for move in record.product_id.stock_move_ids:
                for move_line in move.move_line_ids:
                    if move_line.location_usage in ['internal', 'transit'] \
                            and move_line.location_dest_usage not in ['internal', 'transit']:
                        move_date = Datetime.to_datetime(move_line.date)
                        min_date = min(min_date, move_date)
                        # max_date = max(max_date, move_date)
                        move_date_str = move_date.strftime("%Y%m%d")
                        demand_per_time_period[move_date_str] = demand_per_time_period[move_date_str] + move_line.qty_done \
                            if move_date_str in demand_per_time_period else move_line.qty_done
            period = (datetime.today() - min_date).days
            # compute sales mean and max
            if len(demand_per_time_period) != 0 and period != 0:
                sum_qty = 0.0
                for qty in demand_per_time_period.values():
                    sum_qty += qty
                record.mean_sales = sum_qty / period
                record.max_sales = max(demand_per_time_period.values())
            else:
                record.mean_sales = 0.0
                record.max_sales = 0.0
            # compute sales variance
            variance_sales_sum = 0.0
            for qty in demand_per_time_period.values():
                variance_sales_sum += pow(qty - record.mean_sales, 2)
            if period - 1 > 0:
                record.variance_sales = variance_sales_sum / (period - 1)
            else:
                record.variance_sales = 0.0

    @api.depends('product_id.stock_move_ids')
    def _compute_stats_lead_time(self):
        for record in self:
            supplier_delay = record.supplier_id.delay
            lead_time_list = []
            for move in record.product_id.stock_move_ids:
                if move.location_dest_usage == 'internal':
                    lead_time = supplier_delay + self._calculate_internal_lead_time(move)
                    lead_time_list.append(lead_time)
            nb_lead_time = len(lead_time_list)

            # compute mean
            if nb_lead_time != 0:
                record.mean_lead_time = sum(lead_time_list) / nb_lead_time
            else:
                record.mean_lead_time = 0.0

            # compute max
            record.max_lead_time = max(lead_time_list) if nb_lead_time > 0 else 0

            # compute variance
            variance_lead_time_sum = 0.0
            for ld in lead_time_list:
                variance_lead_time_sum += pow(ld - record.mean_lead_time, 2)
            if nb_lead_time - 1 > 0:
                record.variance_lead_time = variance_lead_time_sum / (nb_lead_time - 1)
            else:
                record.variance_lead_time = 0.0

    def _calculate_internal_lead_time(self, move):
        date_last_move = move.date
        moves = [move]
        origin_moves = set()
        while len(moves) != 0:
            current_move = moves.pop()
            if current_move.location_usage != 'supplier':
                moves.extend(current_move.move_orig_ids)
            else:
                origin_moves.add(current_move)
        if len(origin_moves) > 0:
            origin_mean_date = datetime.fromtimestamp(statistics.mean(
                map(lambda x: datetime.timestamp(x.date), origin_moves)))
        else:
            origin_mean_date = date_last_move
        internal_lead_time = (date_last_move - origin_mean_date).days
        return internal_lead_time

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
