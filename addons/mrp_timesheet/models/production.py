# Part of Odoo. See LICENSE file for full copyright and licensing details.
from collections import defaultdict

from odoo import models, fields, api, _


class Production(models.Model):
    _inherit = 'mrp.production'

    timesheet_count = fields.Float(string='Timesheet activities', compute='_compute_timesheet_count', groups="hr_timesheet.group_hr_timesheet_user")
    timesheet_encode_uom_id = fields.Many2one('uom.uom', related='company_id.timesheet_encode_uom_id')
    timesheet_total_duration = fields.Integer("Timesheet Total Duration", compute='_compute_timesheet_total_duration',
                                              help="Total recorded duration, expressed in the encoding UoM, and rounded to the unit",
                                              compute_sudo=True,
                                              groups="hr_timesheet.group_hr_timesheet_user")
    show_hours_recorded_button = fields.Boolean(compute="_compute_show_hours_recorded_button",
                                                groups="hr_timesheet.group_hr_timesheet_user")

    def _compute_timesheet_count(self):
        timesheets_per_mo = {
            production.id: count
            for production, count in self.env['account.analytic.line']._read_group(
                [('production_id', 'in', self.ids), ('product_id', '!=', False)],
                ['production_id'],
                ['__count'],
            )
        }
        for production in self:
            production.timesheet_count = timesheets_per_mo.get(production.id, 0)

    @api.depends('company_id.project_time_mode_id', 'company_id.timesheet_encode_uom_id', 'service_ids.timesheet_ids')
    def _compute_timesheet_total_duration(self):
        group_data = self.env['account.analytic.line']._read_group([
            ('production_id', 'in', self.ids), ('project_id', '!=', False)
        ], ['production_id'], ['unit_amount:sum'])
        timesheet_unit_amount_dict = defaultdict(float)
        timesheet_unit_amount_dict.update({production.id: unit_amount for production, unit_amount in group_data})
        for production in self:
            total_time = production.company_id.project_time_mode_id._compute_quantity(timesheet_unit_amount_dict[production.id], production.timesheet_encode_uom_id)
            production.timesheet_total_duration = round(total_time)

    def _compute_show_hours_recorded_button(self):
        show_button_ids = self._get_order_with_valid_service_product()
        for order in self:
            order.show_hours_recorded_button = order.timesheet_count or order.project_count and order.id in show_button_ids

    def _get_order_with_valid_service_product(self):
        return self.env['mrp.production.service']._read_group([
            ('production_id', 'in', self.ids),
            ('product_id.service_type', 'not in', ['milestones', 'manual'])
        ], aggregates=['production_id:array_agg'])[0][0]

    def action_view_timesheet(self):
        self.ensure_one()
        if not self.service_ids:
            return {'type': 'ir.actions.act_window_close'}

        action = self.env["ir.actions.actions"]._for_xml_id("mrp_timesheet.timesheet_action_from_manufacturing_order")
        default_service_line = next((service for service in self.service_ids if service.product_id.service_type in ['timesheet', 'manual']), self.env['mrp.production.service'])
        context = {
            'search_default_billable_timesheet': True,
            'default_is_so_line_edited': True,
            'default_so_line': default_service_line.id,
        }  # erase default filters

        tasks = self.service_ids.task_id._filter_access_rules_python('write')
        if tasks:
            context['default_task_id'] = tasks[0].id
        else:
            projects = self.service_ids.project_id._filter_access_rules_python('write')
            if projects:
                context['default_project_id'] = projects[0].id
            elif self.project_ids:
                context['default_project_id'] = self.project_ids[0].id
        action.update({
            'context': context,
            'domain': [('mo_service', 'in', self.service_ids.ids), ('project_id', '!=', False)],
            'help': _("""
                <p class="o_view_nocontent_smiling_face">
                    No activities found. Let's start a new one!
                </p><p>
                    Track your working hours by projects every day and track this time on MOs.
                </p>
            """)
        })

        return action
