# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api, _
from odoo.exceptions import AccessError


class ProjectTask(models.Model):
    _inherit = "project.task"

    production_id = fields.Many2one('mrp.production', 'Manufacturing Order', compute='_compute_production_id', store=True, help="Manufacturing order to which the task is linked.", group_expand="_group_expand_production")
    production_service_id = fields.Many2one(
        'mrp.production.service', 'MO Service Item',
        copy=True, tracking=True, index='btree_not_null', recursive=True,
        compute='_compute_production_service', store=True, readonly=False,
        help="Manufacturing Order Service Item to which the time spent on this task will be added.\n"
             "By default the manufacturing order service item set on the project will be selected. In the absence of one, the last prepaid manufacturing service item that has time remaining will be used.\n"
             "Remove the manufacturing order service item in order to make this task non billable. You can also change or remove the manufacturing order service item of each timesheet entry individually.")
    project_production_id = fields.Many2one('mrp.production', string="Project's manufacturing order", related='project_id.production_id')
    display_production_button = fields.Boolean(string='Display Production', compute='_compute_display_production_button')
    production_state = fields.Selection(related='production_id.state', string='Production State')

    @api.model
    def _group_expand_production(self, productions, domain, order):
        start_date = self._context.get('gantt_start_date')
        scale = self._context.get('gantt_scale')
        if not (start_date and scale):
            return productions
        search_on_comodel = self._search_on_comodel(domain, "production_id", "mrp.production", order)
        if search_on_comodel:
            return search_on_comodel
        return productions

    @api.depends('production_service_id', 'project_id')
    def _compute_production_id(self):
        for task in self:
            production_id = task.production_id or self.env["mrp.production"]
            if task.production_service_id:
                production_id = task.production_service_id.sudo().production_id
            elif task.project_id.production_id:
                production_id = task.project_id.production_id
            task.production_id = production_id

    @api.depends('production_service_id', 'parent_id.production_service_id', 'project_id.production_service_id', 'milestone_id.production_service_id')
    def _compute_production_service(self):
        for task in self:
            if not task.production_service_id:
                # if the project_id is set then it means the task is classic task or a subtask with another project than its parent.
                # To determine the production_service_id, we first need to look at the parent before the project to manage the case of subtasks.
                # Two sub-tasks in the same project do not necessarily have the same production_service_id (need to look at the parent task).
                production_service = False
                if task.parent_id.production_service_id:
                    production_service = task.parent_id.production_service_id
                elif task.project_id.production_service_id:
                    production_service = task.project_id.production_service_id
                task.production_service_id = production_service or task.milestone_id.production_service_id

    @api.depends('production_id')
    def _compute_display_production_button(self):
        if not self.production_id:
            self.display_sale_order_button = False
            return
        try:
            productions = self.env['mrp.production'].search([('id', 'in', self.production_id.ids)])
            for task in self:
                task.display_production_button = task.production_id in productions
        except AccessError:
            self.display_production_button = False

    def _get_action_view_mo_ids(self):
        return self.production_id.ids

    def action_view_mo(self):
        mo_ids = self._get_action_view_mo_ids()
        action_window = {
            "type": "ir.actions.act_window",
            "res_model": "mrp.production",
            "name": _("Manufacturing Order"),
            "views": [[False, "tree"], [False, "kanban"], [False, "form"]],
            "context": {"create": False, "show_production": True},
            "domain": [["id", "in", mo_ids]],
        }
        if len(mo_ids) == 1:
            action_window["views"] = [[False, "form"]]
            action_window["res_id"] = mo_ids[0]

        return action_window


class ProjectTaskRecurrence(models.Model):
    _inherit = 'project.task.recurrence'

    @api.model
    def _get_recurring_fields_to_copy(self):
        return super()._get_recurring_fields_to_copy() + ['production_service_id']
