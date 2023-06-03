import statistics

from odoo import models, api, fields, _
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
            move_lines = self.env['stock.move.line'].read_group([
                ('product_id', '=', record.product_id.id),
                ('state', '=', 'done'),
                ('location_id.usage', 'in', ['internal', 'transit']),
                ('location_dest_id.usage', '=', 'customer')
                ], ['qty_done:sum'], ['date:day'])
            period = 0
            if len(move_lines) != 0:
                min_date = datetime.strptime(move_lines[0]['date:day'], '%d %b %Y')
                period = (datetime.today() - min_date).days

            # compute sales mean and max
            if len(move_lines) != 0 and period != 0:
                sum_qty = 0.0
                max_qty = 0.0
                for day_moves in move_lines:
                    sum_qty += day_moves['qty_done']
                    max_qty = max(max_qty, day_moves['qty_done'])
                record.mean_sales = round(sum_qty / period, 2)
                record.max_sales = max_qty
            else:
                record.mean_sales = 0.0
                record.max_sales = 0.0
            # compute sales variance
            variance_sales_sum = 0.0
            for day_moves in move_lines:
                variance_sales_sum += pow(day_moves['qty_done'] - record.mean_sales, 2)
            mean_sales_square = pow(record.max_sales, 2)
            # add days with no sales to the variance
            variance_sales_sum += mean_sales_square * (period - len(move_lines))
            if period - 1 > 0:
                record.variance_sales = round(variance_sales_sum / (period - 1), 2)
            else:
                record.variance_sales = 0.0

    @api.depends('product_id.stock_move_ids')
    def _compute_stats_lead_time(self):
        for record in self:
            basic_delay = 0.0
            if record.supplier_id:
                basic_delay = record.supplier_id.delay
            elif record.product_id.product_tmpl_id.produce_delay:
                basic_delay = record.product_id.product_tmpl_id.produce_delay
            lead_time_list = []
            for move in record.product_id.stock_move_ids:
                if move.location_dest_id.usage == 'internal':
                    lead_time = basic_delay + self._calculate_internal_lead_time(move)
                    lead_time_list.append(lead_time)
            nb_lead_time = len(lead_time_list)

            # compute mean and max
            if nb_lead_time != 0:
                record.mean_lead_time = round(sum(lead_time_list) / nb_lead_time, 2)
                record.max_lead_time = max(lead_time_list)
            else:
                # take the theoretic lead time
                if record.lead_days_date:
                    lead_days = (record.lead_days_date - fields.Date.today()).days
                else:
                    lead_days = 0
                record.mean_lead_time = lead_days
                record.max_lead_time = lead_days

            # compute variance
            variance_lead_time_sum = 0.0
            for ld in lead_time_list:
                variance_lead_time_sum += pow(ld - record.mean_lead_time, 2)
            if nb_lead_time - 1 > 0:
                record.variance_lead_time = round(variance_lead_time_sum / (nb_lead_time - 1), 2)
            else:
                record.variance_lead_time = 0.0

    def _calculate_internal_lead_time(self, move):
        date_last_move = move.date
        moves = [move]
        origin_moves = set()
        while len(moves) != 0:
            current_move = moves.pop()
            if current_move.location_id.usage != 'supplier':
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

    @api.model
    def get_safety_stock_stats(self, orderpoint_ids):
        return self._serialize_stats(self.browse(orderpoint_ids))

    @api.model
    def _serialize_stats(self, orderpoint_ids):
        res = {}
        for orderpoint in orderpoint_ids:
            data = {
                'orderpoint_id': orderpoint.id,
                'product_id': orderpoint.product_id.id,
                'product_name': orderpoint.product_id.name,
                'product_code': orderpoint.product_id.code,
                'product_min_qty': orderpoint.product_min_qty,
                'mean_sales': orderpoint.mean_sales,
                'variance_sales': orderpoint.variance_sales,
                'max_sales': orderpoint.max_sales,
                'mean_lead_time': orderpoint.mean_lead_time,
                'variance_lead_time': orderpoint.variance_lead_time,
                'max_lead_time': orderpoint.max_lead_time,
                'is_html_type': True
            }
            res[orderpoint.id] = data
        return res
