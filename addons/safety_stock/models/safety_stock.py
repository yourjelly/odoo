from odoo import models, api, fields, _
from odoo.fields import Datetime
from datetime import datetime

class SafetyStockModel(models.Model):
    _inherit = "stock.warehouse.orderpoint"

    mean_sales = fields.Integer(compute="_compute_mean_sales")  # mean nb sales per day
    mean_lead_time = fields.Integer(compute="_compute_mean_lead_time")  # mean lead time in day
    max_sales = fields.Integer(compute="_compute_mean_sales")  # max nb sales in one day
    max_lead_time = fields.Integer(compute="_compute_mean_lead_time")  # max lead time in day

    SS1 = fields.Integer(compute="_compute_ss1")
    SS2 = fields.Integer(compute="_compute_ss2")

    @api.depends('product_id.stock_move_ids')
    def _compute_mean_sales(self):
        for record in self:
            demand_per_time_period = dict()
            min_date = datetime.max
            #max_date = datetime.min
            for move in record.product_id.stock_move_ids:
                for move_line in move.move_line_ids:
                    if move_line.location_usage in ['internal', 'transit'] \
                            and move_line.location_dest_usage not in ['internal', 'transit']:
                        move_date = Datetime.to_datetime(move_line.date)
                        if move_date < min_date:
                            min_date = move_date
                        #elif move_date > max_date:
                            #max_date = move_date
                        move_date_str = move_date.strftime("%Y%m%d")
                        if move_date_str in demand_per_time_period:
                            demand_per_time_period[move_date_str] = demand_per_time_period[move_date_str] + move_line.qty_done
                        else:
                            demand_per_time_period[move_date_str] = move_line.qty_done
            period = (datetime.today() - min_date).days
            if len(demand_per_time_period) != 0 and period != 0:
                sum_qty = 0.0
                for qty in demand_per_time_period.values():
                    sum_qty += qty
                mean = sum_qty / period
                record.mean_sales = mean
                record.max_sales = max(demand_per_time_period.values())
            else:
                record.mean_sales = 0.0
                record.max_sales = 0.0

    @api.depends('product_id.stock_move_ids')
    def _compute_mean_lead_time(self):
        for record in self:
            sum_days = 0.0
            nb_order = 0
            max_ld = 0
            for move in record.product_id.stock_move_ids:
                order = move.purchase_line_id.order_id
                if order:
                    po_approve = Datetime.to_datetime(order.date_approve)
                    po_deliver = Datetime.to_datetime(order.effective_date)
                    diff_date = po_deliver - po_approve
                    lead_time = max(diff_date.days, 1)
                    sum_days += lead_time
                    nb_order += 1
                    max_ld = max(max_ld, lead_time)
            if nb_order != 0:
                record.mean_lead_time = sum_days / nb_order
            else:
                record.mean_lead_time = 0.0
            record.max_lead_time = max_ld

    @api.depends('mean_sales')
    def _compute_ss1(self):
        for record in self:
            record.SS1 = record.mean_sales * 30

    @api.depends('mean_sales', 'mean_lead_time', 'max_sales', 'max_lead_time')
    def _compute_ss2(self):
        for record in self:
            record.SS2 = (record.max_lead_time * record.max_sales) - (record.mean_lead_time * record.mean_sales)


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
