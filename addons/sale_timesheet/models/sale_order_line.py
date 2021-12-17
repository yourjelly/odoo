# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import math
from collections import defaultdict

from odoo import api, fields, models, _
from odoo.osv import expression
from odoo.tools import format_amount


class SaleOrderLine(models.Model):
    _inherit = "sale.order.line"

    qty_delivered_method = fields.Selection(selection_add=[('timesheet', 'Timesheets')])
    analytic_line_ids = fields.One2many(domain=[('project_id', '=', False)])  # only analytic lines, not timesheets (since this field determine if SO line came from expense)
    remaining_hours_available = fields.Boolean(compute='_compute_remaining_hours_available', compute_sudo=True)
    remaining_hours = fields.Float('Remaining Hours on SO', compute='_compute_remaining_hours', compute_sudo=True, store=True)
    has_displayed_warning_upsell = fields.Boolean('Has Displayed Warning Upsell')

    def name_get(self):
        res = super(SaleOrderLine, self).name_get()
        with_remaining_hours = self.env.context.get('with_remaining_hours')
        with_price_unit = self.env.context.get('with_price_unit')
        if with_remaining_hours or with_price_unit:
            names = dict(res)
            result = []
            uom_hour = with_remaining_hours and self.env.ref('uom.product_uom_hour')
            uom_day = with_remaining_hours and self.env.ref('uom.product_uom_day')
            sols_by_so_dict = with_price_unit and defaultdict(lambda: self.env[self._name])  # key: (sale_order_id, product_id), value: sale order line
            for line in self:
                if with_remaining_hours:
                    name = names.get(line.id)
                    if line.remaining_hours_available:
                        company = self.env.company
                        encoding_uom = company.timesheet_encode_uom_id
                        remaining_time = ''
                        if encoding_uom == uom_hour:
                            hours, minutes = divmod(abs(line.remaining_hours) * 60, 60)
                            round_minutes = minutes / 30
                            minutes = math.ceil(round_minutes) if line.remaining_hours >= 0 else math.floor(round_minutes)
                            if minutes > 1:
                                minutes = 0
                                hours += 1
                            else:
                                minutes = minutes * 30
                            remaining_time = ' ({sign}{hours:02.0f}:{minutes:02.0f})'.format(
                                sign='-' if line.remaining_hours < 0 else '',
                                hours=hours,
                                minutes=minutes)
                        elif encoding_uom == uom_day:
                            remaining_days = company.project_time_mode_id._compute_quantity(line.remaining_hours, encoding_uom, round=False)
                            remaining_time = ' ({qty:.02f} {unit})'.format(
                                qty=remaining_days,
                                unit=_('days') if abs(remaining_days) > 1 else _('day')
                            )
                        name = '{name}{remaining_time}'.format(
                            name=name,
                            remaining_time=remaining_time
                        )
                        if with_price_unit:
                            names[line.id] = name
                    if not with_price_unit:
                        result.append((line.id, name))
                if with_price_unit:
                    sols_by_so_dict[line.order_id.id, line.product_id.id] += line

            if with_price_unit:
                for sols in sols_by_so_dict.values():
                    if len(sols) > 1:
                        result += [(
                            line.id,
                            '%s - %s' % (
                                names.get(line.id), format_amount(self.env, line.price_unit, line.currency_id))
                        ) for line in sols]
                    else:
                        result.append((sols.id, names.get(sols.id)))
            return result
        return res

    @api.depends('product_id.service_policy')
    def _compute_remaining_hours_available(self):
        uom_hour = self.env.ref('uom.product_uom_hour')
        for line in self:
            is_ordered_timesheet = line.product_id.service_policy == 'ordered_timesheet'
            is_time_product = line.product_uom.category_id == uom_hour.category_id
            line.remaining_hours_available = is_ordered_timesheet and is_time_product

    @api.depends('qty_delivered', 'product_uom_qty', 'analytic_line_ids')
    def _compute_remaining_hours(self):
        uom_hour = self.env.ref('uom.product_uom_hour')
        for line in self:
            remaining_hours = None
            if line.remaining_hours_available:
                qty_left = line.product_uom_qty - line.qty_delivered
                remaining_hours = line.product_uom._compute_quantity(qty_left, uom_hour)
            line.remaining_hours = remaining_hours

    @api.depends('product_id')
    def _compute_qty_delivered_method(self):
        """ Sale Timesheet module compute delivered qty for product [('type', 'in', ['service']), ('service_type', '=', 'timesheet')] """
        super(SaleOrderLine, self)._compute_qty_delivered_method()
        for line in self:
            if not line.is_expense and line.product_id.type == 'service' and line.product_id.service_type == 'timesheet':
                line.qty_delivered_method = 'timesheet'

    @api.depends('analytic_line_ids.project_id', 'project_id.pricing_type')
    def _compute_qty_delivered(self):
        super(SaleOrderLine, self)._compute_qty_delivered()

        lines_by_timesheet = self.filtered(lambda sol: sol.qty_delivered_method == 'timesheet')
        domain = lines_by_timesheet._timesheet_compute_delivered_quantity_domain()
        mapping = lines_by_timesheet.sudo()._get_delivered_quantity_by_analytic(domain)
        for line in lines_by_timesheet:
            line.qty_delivered = mapping.get(line.id or line._origin.id, 0.0)

    def _timesheet_compute_delivered_quantity_domain(self):
        """ Hook for validated timesheet in addionnal module """
        domain = [('project_id', '!=', False)]
        if self._context.get('accrual_entry_date'):
            domain += [('date', '<=', self._context['accrual_entry_date'])]
        return domain

    ###########################################
    # Service : Project and task generation
    ###########################################

    def _convert_qty_company_hours(self, dest_company):
        company_time_uom_id = dest_company.project_time_mode_id
        if self.product_uom.id != company_time_uom_id.id and self.product_uom.category_id.id == company_time_uom_id.category_id.id:
            planned_hours = self.product_uom._compute_quantity(self.product_uom_qty, company_time_uom_id)
        else:
            planned_hours = self.product_uom_qty
        return planned_hours

    def _timesheet_create_project(self):
        project = super()._timesheet_create_project()
        project.write({'allow_timesheets': True})
        return project

    def _timesheet_create_project_prepare_values(self):
        """Generate project values"""
        values = super()._timesheet_create_project_prepare_values()
        values['allow_billable'] = True
        return values

    def _recompute_qty_to_invoice(self, start_date, end_date):
        """ Recompute the qty_to_invoice field for product containing timesheets

            Search the existed timesheets between the given period in parameter.
            Retrieve the unit_amount of this timesheet and then recompute
            the qty_to_invoice for each current product.

            :param start_date: the start date of the period
            :param end_date: the end date of the period
        """
        lines_by_timesheet = self.filtered(lambda sol: sol.product_id and sol.product_id._is_delivered_timesheet())
        domain = lines_by_timesheet._timesheet_compute_delivered_quantity_domain()
        refund_account_moves = self.order_id.invoice_ids.filtered(lambda am: am.state == 'posted' and am.move_type == 'out_refund').reversed_entry_id
        timesheet_domain = [
            '|',
            ('timesheet_invoice_id', '=', False),
            ('timesheet_invoice_id.state', '=', 'cancel')]
        if refund_account_moves:
            credited_timesheet_domain = [('timesheet_invoice_id.state', '=', 'posted'), ('timesheet_invoice_id', 'in', refund_account_moves.ids)]
            timesheet_domain = expression.OR([timesheet_domain, credited_timesheet_domain])
        domain = expression.AND([domain, timesheet_domain])
        if start_date:
            domain = expression.AND([domain, [('date', '>=', start_date)]])
        if end_date:
            domain = expression.AND([domain, [('date', '<=', end_date)]])
        mapping = lines_by_timesheet.sudo()._get_delivered_quantity_by_analytic(domain)

        for line in lines_by_timesheet:
            line.qty_to_invoice = mapping.get(line.id, 0.0)
