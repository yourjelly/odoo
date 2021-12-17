# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from collections import defaultdict

from odoo import api, fields, models
from odoo.tools import float_compare


class SaleOrder(models.Model):
    _inherit = 'sale.order'

    timesheet_ids = fields.Many2many('account.analytic.line', compute='_compute_timesheet_ids', string='Timesheet activities associated to this sale')
    timesheet_count = fields.Float(string='Timesheet activities', compute='_compute_timesheet_ids', groups="hr_timesheet.group_hr_timesheet_user")

    # override domain
    project_id = fields.Many2one(domain="[('pricing_type', '!=', 'employee_rate'), ('analytic_account_id', '!=', False), ('company_id', '=', company_id)]")
    timesheet_encode_uom_id = fields.Many2one('uom.uom', related='company_id.timesheet_encode_uom_id')
    timesheet_total_duration = fields.Integer("Timesheet Total Duration", compute='_compute_timesheet_total_duration', help="Total recorded duration, expressed in the encoding UoM, and rounded to the unit")

    def _compute_timesheet_ids(self):
        timesheet_groups = self.env['account.analytic.line'].sudo().read_group(
            [('so_line', 'in', self.mapped('order_line').ids), ('project_id', '!=', False)],
            ['so_line', 'ids:array_agg(id)'],
            ['so_line'])
        timesheets_per_sol = {group['so_line'][0]: (group['ids'], group['so_line_count']) for group in timesheet_groups}

        for order in self:
            timesheet_ids = []
            timesheet_count = 0
            for sale_line_id in order.order_line.filtered('is_service').ids:
                list_timesheet_ids, count = timesheets_per_sol.get(sale_line_id, ([], 0))
                timesheet_ids.extend(list_timesheet_ids)
                timesheet_count += count

            order.update({
                'timesheet_ids': self.env['account.analytic.line'].browse(timesheet_ids),
                'timesheet_count': timesheet_count,
            })

    @api.depends('company_id.project_time_mode_id', 'timesheet_ids', 'company_id.timesheet_encode_uom_id')
    def _compute_timesheet_total_duration(self):
        if not self.user_has_groups('hr_timesheet.group_hr_timesheet_user'):
            self.update({'timesheet_total_duration': 0})
            return
        group_data = self.env['account.analytic.line'].sudo().read_group([
            ('order_id', 'in', self.ids)
        ], ['order_id', 'unit_amount'], ['order_id'])
        timesheet_unit_amount_dict = defaultdict(float)
        timesheet_unit_amount_dict.update({data['order_id'][0]: data['unit_amount'] for data in group_data})
        for sale_order in self:
            total_time = sale_order.company_id.project_time_mode_id._compute_quantity(timesheet_unit_amount_dict[sale_order.id], sale_order.timesheet_encode_uom_id)
            sale_order.timesheet_total_duration = round(total_time)

    def _compute_field_value(self, field):
        super()._compute_field_value(field)
        if field.name != 'invoice_status' or self.env.context.get('mail_activity_automation_skip'):
            return

        # Get SOs which their state is not equal to upselling or invoied and if at least a SOL has warning prepaid service upsell set to True and the warning has not already been displayed
        upsellable_orders = self.filtered(lambda so:
            so.state == 'sale'
            and so.invoice_status not in ('upselling', 'invoiced')
            and (so.user_id or so.partner_id.user_id)  # salesperson needed to assign upsell activity
        )
        for order in upsellable_orders:
            upsellable_lines = order._get_prepaid_service_lines_to_upsell()
            if upsellable_lines:
                order._create_upsell_activity()
                # We want to display only one time the warning for each SOL
                upsellable_lines.write({'has_displayed_warning_upsell': True})

    def _get_prepaid_service_lines_to_upsell(self):
        """ Retrieve all sols which need to display an upsell activity warning in the SO

            These SOLs should contain a product which has:
                - type="service",
                - service_policy="ordered_timesheet",
        """
        self.ensure_one()
        precision = self.env['decimal.precision'].precision_get('Product Unit of Measure')
        return self.order_line.filtered(lambda sol:
            sol.is_service
            and not sol.has_displayed_warning_upsell  # we don't want to display many times the warning each time we timesheet on the SOL
            and sol.product_id.service_policy == 'ordered_timesheet'
            and float_compare(
                sol.qty_delivered,
                sol.product_uom_qty * (sol.product_id.service_upsell_threshold or 1.0),
                precision_digits=precision
            ) > 0
        )

    def action_view_timesheet(self):
        self.ensure_one()
        action = self.env["ir.actions.actions"]._for_xml_id("sale_timesheet.timesheet_action_from_sales_order")
        action['context'] = {
            'search_default_billable_timesheet': True
        }  # erase default filters
        if self.timesheet_count > 0:
            action['domain'] = [('so_line', 'in', self.order_line.ids)]
        else:
            action = {'type': 'ir.actions.act_window_close'}
        return action

    def _create_invoices(self, grouped=False, final=False, start_date=None, end_date=None):
        """ Override the _create_invoice method in sale.order model in sale module
            Add new parameter in this method, to invoice sale.order with a date. This date is used in sale_make_invoice_advance_inv into this module.
            :param start_date: the start date of the period
            :param end_date: the end date of the period
            :return {account.move}: the invoices created
        """
        moves = super(SaleOrder, self)._create_invoices(grouped, final)
        moves._link_timesheets_to_invoice(start_date, end_date)
        return moves
