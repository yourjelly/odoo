# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import date
import calendar
from odoo import api, models
from dateutil.relativedelta import relativedelta

class StockMoveLine(models.Model):
    _inherit = "stock.move.line"

    def _convert_to_actual_dates(self, date_range_obj):
        if date_range_obj['range_type'] == 'year':
            return date(date_range_obj['year'], 1, 1), date(date_range_obj['year'], 12, 31)
        elif date_range_obj['range_type'] == 'quarter':
            month_start = (date_range_obj['quarter'] - 1) * 3 + 1
            month_end = month_start + 2
            return date(date_range_obj['year'], month_start, 1), date(date_range_obj['year'], month_end, calendar.monthrange(date_range_obj['year'], month_end)[1])
        elif date_range_obj['range_type'] == 'month':
            return date(date_range_obj['year'], date_range_obj['month'], 1), date(date_range_obj['year'], date_range_obj['month'], calendar.monthrange(date_range_obj['year'], date_range_obj['month'])[1])
        elif date_range_obj['range_type'] == 'day':
            return date(date_range_obj['year'], date_range_obj['month'], date_range_obj['day']), date(date_range_obj['year'], date_range_obj['month'], date_range_obj['day'])
        
    @api.model
    def get_stock_in(self, args):
        location_id = args[0]['location_id']
        product_id = args[0]['product_id']
        date_range = args[0]['date_range']
        start_date, end_date = self._convert_to_actual_dates(date_range)
        domain = [
            ('location_dest_id', '=', location_id),
            ('product_id', '=', product_id),
            ('date', '>=', start_date),
            ('date', '<=', end_date),
            ('state', '=', 'done')
        ]
        stock_in_lines = self.search(domain)
        return [sum(stock_in_lines.mapped('qty_done'))]

    @api.model
    def get_stock_out(self, args):
        location_id = args[0]['location_id']
        product_id = args[0]['product_id']
        date_range = args[0]['date_range']
        start_date, end_date = self._convert_to_actual_dates(date_range)

        domain = [
            ('location_id', '=', location_id),
            ('product_id', '=', product_id),
            ('date', '>=', start_date),
            ('date', '<=', end_date),
            ('state', '=', 'done')
        ]
        stock_out_lines = self.search(domain)
        return [sum(stock_out_lines.mapped('qty_done'))]

    @api.model
    def get_stock_opening(self, args):
         # Assuming the opening stock for a day is the closing stock of the previous day
        location_id = args[0]['location_id']
        product_id = args[0]['product_id']
        date = args[0]['date_range']
        previous_day = date - relativedelta(days=1)
        breakpoint()
        closing_previous_day = self.get_stock_closing(location_id, product_id, previous_day)
        in_qty_today = self.get_stock_in(location_id, product_id, date)
        out_qty_today = self.get_stock_out(location_id, product_id, date)
        return [closing_previous_day - out_qty_today + in_qty_today]

    @api.model
    def get_stock_closing(self, args):
        location_id = args[0]['location_id']
        product_id = args[0]['product_id']
        date = args[0]['date_range']
        opening_today = self.get_stock_opening(location_id, product_id, date)
        in_qty_today = self.get_stock_in(location_id, product_id, date)
        out_qty_today = self.get_stock_out(location_id, product_id, date)
        return [opening_today + in_qty_today - out_qty_today]
