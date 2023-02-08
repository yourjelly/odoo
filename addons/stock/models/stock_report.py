# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import re
from babel.dates import get_quarter_names
from datetime import datetime, timedelta

from odoo.tools.misc import DEFAULT_SERVER_DATE_FORMAT
from odoo import models, fields, api, _, osv, Command
from odoo.osv.expression import AND
from odoo.tools import date_utils, get_lang
from odoo.tools.misc import format_date


class StockReportNew(models.AbstractModel):
    _name = "stock.report.new"
    _description = "New Stock Report"

    #  CORE ==========================================================================================================================================

    def get_report_informations(self, previous_options=None):
        options = self._get_options(previous_options)
        product_domain = []
        move_domain = [
            ('date', '>=', options['date']['date_from']),
            ('date', '<=', options['date']['date_to']),
            ('picking_code', 'in', ['incoming', 'outgoing']),
        ]

        if options.get('product_ids'):
            product_domain = AND([product_domain, [('id', 'in', options['product_ids'])]])
        if options.get('product_categories_ids'):
            product_domain = AND([product_domain, [('product_tmpl_id.categ_id', 'child_of', options['product_categories_ids'])]])
        if options.get('selected_warehouse'):
            lot_stock_id = self.env['stock.warehouse'].browse(options['selected_warehouse']).lot_stock_id.id
            options['lot_stock_id'] = lot_stock_id
            product_domain = AND([product_domain, [
                '|',
                ('stock_move_ids.location_id', '=', lot_stock_id),
                ('stock_move_ids.location_dest_id', '=', lot_stock_id)
            ]])
            move_domain = AND([move_domain, [
                '|',
                ('location_id', '=', lot_stock_id),
                ('location_dest_id', '=', lot_stock_id)
            ]])

        product_data = self.env['product.product'].with_context(to_date=datetime.strptime(options['date']['date_from'], '%Y-%m-%d')).search_read(product_domain, fields=['id', 'name', 'qty_available'])
        to_product_data = self.env['product.product'].with_context(to_date=datetime.strptime(options['date']['date_to'], '%Y-%m-%d')).search_read(product_domain, fields=['id', 'qty_available'])

        moves_data = self.env['stock.move'].search_read(move_domain, fields=['product_id', 'product_qty', 'picking_code'])

        in_qty = {}
        out_qty = {}

        for data in product_data:
            for to_data in to_product_data:
                if to_data['id'] == data['id']:
                    data['qty_available_end'] = to_data['qty_available']
        for move in moves_data:
            if move['picking_code'] == 'incoming':
                in_qty.setdefault(move['product_id'][0], 0)
                in_qty[move['product_id'][0]] += move['product_qty']
            if move['picking_code'] == 'outgoing':
                out_qty.setdefault(move['product_id'][0], 0)
                out_qty[move['product_id'][0]] += move['product_qty']

        main_html = self.env['ir.qweb']._render("stock.stock_main_template", {
            'options': options,
            'product_data': product_data,
            'in_qty': in_qty,
            'out_qty': out_qty
        })

        info = {
            'options': options,
            'main_html': main_html,
            'searchview_html': self.env['ir.ui.view']._render_template('stock.search_template', {'options': options}),
        }
        return info

    def _get_options(self, previous_options=None):
        # Create default options.
        options = previous_options or {}
        if 'product_ids' not in options:
            options['product_ids'] = []
        if 'product_categories_ids' not in options:
            options['product_categories_ids'] = []

        self._init_options_date(options, previous_options=previous_options)
        self._init_options_warehouse(options, previous_options=previous_options)

        return options

    def compute_fiscalyear_dates(self, current_date):
        """Compute the start and end dates of the fiscal year where the given 'date' belongs to.

        :param current_date: A datetime.date/datetime.datetime object.
        :return: A dictionary containing:
            * date_from
            * date_to
        """
        date_str = current_date.strftime(DEFAULT_SERVER_DATE_FORMAT)
        first_day = current_date.replace(day = 1, month=1)
        last_day = current_date.replace(day = 31, month=12)
        return {
            'date_from': first_day,
            'date_to': last_day,
        }


    def _init_options_date(self, options, previous_options=None):
        """ Initialize the 'date' options key.

        :param options:             The current report options to build.
        :param previous_options:    The previous options coming from another report.
        """
        previous_date = (previous_options or {}).get('date', {})
        previous_date_to = previous_date.get('date_to')
        previous_date_from = previous_date.get('date_from')
        previous_mode = previous_date.get('mode')
        previous_filter = previous_date.get('filter', 'custom')

        default_filter = 'this_year' # self.default_opening_date_filter
        # options_mode = 'range' if self.filter_date_range else 'single'
        options_mode = 'range' if True else 'single'
        date_from = date_to = period_type = False

        if previous_mode == 'single' and options_mode == 'range':
            # 'single' date mode to 'range'.

            if previous_filter:
                date_to = fields.Date.from_string(previous_date_to or previous_date_from)
                date_from = self.compute_fiscalyear_dates(date_to)['date_from']
                options_filter = 'custom'
            else:
                options_filter = default_filter

        elif previous_mode == 'range' and options_mode == 'single':
            # 'range' date mode to 'single'.

            if previous_filter == 'custom':
                date_to = fields.Date.from_string(previous_date_to or previous_date_from)
                date_from = date_utils.get_month(date_to)[0]
                options_filter = 'custom'
            elif previous_filter:
                options_filter = previous_filter
            else:
                options_filter = default_filter

        elif (previous_mode is None or previous_mode == options_mode) and previous_date:
            # Same date mode.

            if previous_filter == 'custom':
                if options_mode == 'range':
                    date_from = fields.Date.from_string(previous_date_from)
                    date_to = fields.Date.from_string(previous_date_to)
                else:
                    date_to = fields.Date.from_string(previous_date_to or previous_date_from)
                    date_from = date_utils.get_month(date_to)[0]
                options_filter = 'custom'
            else:
                options_filter = previous_filter

        else:
            # Default.
            options_filter = default_filter

        # Compute 'date_from' / 'date_to'.
        if not date_from or not date_to:
            if options_filter == 'today':
                date_to = fields.Date.context_today(self)
                date_from = self.compute_fiscalyear_dates(date_to)['date_from']
                period_type = 'today'
            elif 'month' in options_filter:
                date_from, date_to = date_utils.get_month(fields.Date.context_today(self))
                period_type = 'month'
            elif 'quarter' in options_filter:
                date_from, date_to = date_utils.get_quarter(fields.Date.context_today(self))
                period_type = 'quarter'
            elif 'year' in options_filter:
                company_fiscalyear_dates = self.compute_fiscalyear_dates(fields.Date.context_today(self))
                date_from = company_fiscalyear_dates['date_from']
                date_to = company_fiscalyear_dates['date_to']

        options['date'] = self._get_dates_period(
            date_from,
            date_to,
            options_mode,
            period_type=period_type,
        )
        if 'last' in options_filter:
            options['date'] = self._get_dates_previous_period(options, options['date'])
        options['date']['filter'] = options_filter

    @api.model
    def _get_dates_previous_period(self, options, period_vals):
        '''Shift the period to the previous one.
        :param period_vals: A dictionary generated by the _get_dates_period method.
        :return:            A dictionary containing:
            * date_from * date_to * string * period_type *
        '''
        period_type = period_vals['period_type']
        mode = period_vals['mode']
        date_from = fields.Date.from_string(period_vals['date_from'])
        date_to = date_from - timedelta(days=1)

        if period_type in ('fiscalyear', 'today'):
            # Don't pass the period_type to _get_dates_period to be able to retrieve the account.fiscal.year record if
            # necessary.
            company_fiscalyear_dates = self.compute_fiscalyear_dates(date_to)
            return self._get_dates_period(company_fiscalyear_dates['date_from'], company_fiscalyear_dates['date_to'], mode)
        if period_type in ('month', 'custom'):
            return self._get_dates_period(*date_utils.get_month(date_to), mode, period_type='month')
        if period_type == 'quarter':
            return self._get_dates_period(*date_utils.get_quarter(date_to), mode, period_type='quarter')
        if period_type == 'year':
            return self._get_dates_period(*date_utils.get_fiscal_year(date_to), mode, period_type='year')
        return None

    @api.model
    def _get_dates_period(self, date_from, date_to, mode, period_type=None):
        def match(dt_from, dt_to):
            return (dt_from, dt_to) == (date_from, date_to)

        string = None
        # If no date_from or not date_to, we are unable to determine a period
        date = date_to or date_from
        if not period_type or period_type == 'custom':
            company_fiscalyear_dates = self.compute_fiscalyear_dates(date)
            if match(company_fiscalyear_dates['date_from'], company_fiscalyear_dates['date_to']):
                period_type = 'fiscalyear'
                if company_fiscalyear_dates.get('record'):
                    string = company_fiscalyear_dates['record'].name
            elif match(*date_utils.get_month(date)):
                period_type = 'month'
            elif match(*date_utils.get_quarter(date)):
                period_type = 'quarter'
            elif match(*date_utils.get_fiscal_year(date)):
                period_type = 'year'
            elif match(date_utils.get_month(date)[0], fields.Date.today()):
                period_type = 'today'
            else:
                period_type = 'custom'
        elif period_type == 'fiscalyear':
            date = date_to or date_from
            company_fiscalyear_dates = self.compute_fiscalyear_dates(date)
            record = company_fiscalyear_dates.get('record')
            string = record and record.name

        if not string:
            fy_day = self.compute_fiscalyear_dates(date).get("date_to").day
            fy_month = int(self.compute_fiscalyear_dates(date).get("date_to").month)
            if mode == 'single':
                string = _('As of %s') % (format_date(self.env, fields.Date.to_string(date_to)))
            elif period_type == 'year' or (
                    period_type == 'fiscalyear' and (date_from, date_to) == date_utils.get_fiscal_year(date_to)):
                string = date_to.strftime('%Y')
            elif period_type == 'fiscalyear' and (date_from, date_to) == date_utils.get_fiscal_year(date_to, day=fy_day, month=fy_month):
                string = '%s - %s' % (date_to.year - 1, date_to.year)
            elif period_type == 'month':
                string = format_date(self.env, fields.Date.to_string(date_to), date_format='MMM yyyy')
            elif period_type == 'quarter':
                quarter_names = get_quarter_names('abbreviated', locale=get_lang(self.env).code)
                string = u'%s\N{NO-BREAK SPACE}%s' % (
                    quarter_names[date_utils.get_quarter_number(date_to)], date_to.year)
            else:
                dt_from_str = format_date(self.env, fields.Date.to_string(date_from))
                dt_to_str = format_date(self.env, fields.Date.to_string(date_to))
                string = _('From %s\nto  %s') % (dt_from_str, dt_to_str)

        return {
            'string': string,
            'period_type': period_type,
            'mode': mode,
            'date_from': date_from and fields.Date.to_string(date_from) or False,
            'date_to': fields.Date.to_string(date_to),
        }

    def format_date(self, options, dt_filter='date'):
        date_from = fields.Date.from_string(options[dt_filter]['date_from'])
        date_to = fields.Date.from_string(options[dt_filter]['date_to'])
        return self._get_dates_period(date_from, date_to, options['date']['mode'])['string']

    def _init_options_warehouse(self, options, previous_options=None):
        warehouse_ids = self.env['stock.warehouse'].search([])
        if 'selected_warehouse' not in options:
            options['selected_warehouse'] = warehouse_ids[0].id

        if not options.get('available_warehouses'):
            for warehouse in warehouse_ids:
                options.setdefault('available_warehouses', [])
                options['available_warehouses'].append({
                    'id': warehouse.id,
                    'name': warehouse.name,
                })

    @api.model
    def action_inventory_history(self, options, params):
        action = {
            'name': _('History'),
            'view_mode': 'list,form',
            'res_model': 'stock.move.line',
            'views': [(self.env.ref('stock.view_move_line_tree').id, 'list'), (False, 'form')],
            'type': 'ir.actions.act_window',
            'context': {
                'search_default_done': 1,
                'search_default_product_id': params['product_id'],
            },
            'domain': [
                '&',
                '&',
                '&',
                    ('company_id', 'in', self._context['allowed_company_ids']),
                    ('date', '>=', options['date']['date_from']),
                    ('date', '<=', options['date']['date_to']),
                '|',
                    ('location_id', '=', options['lot_stock_id']),
                    ('location_dest_id', '=', options['lot_stock_id']),
            ],
        }
        return action
