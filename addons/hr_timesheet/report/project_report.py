# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api


class ReportProjectTaskUser(models.Model):
    _inherit = "report.project.task.user"

    manager_id = fields.Many2one('res.users', 'Manager', readonly=True)
    project_manager_id = fields.Many2one('res.users', 'Project Manager', readonly=True)
    overtime = fields.Float('Overtime', readonly=True)
    hours_planned = fields.Float('Planned Hours', readonly=True)
    hours_effective = fields.Float('Effective Hours', readonly=True)
    remaining_hours = fields.Float('Remaining Hours', readonly=True)
    progress = fields.Float('Progress', group_operator='avg', readonly=True)

    def _select(self):
        return super(ReportProjectTaskUser, self)._select() + """,
            manager.user_id as manager_id,
            p_manager.user_id as project_manager_id,
            t.overtime,
            (t.effective_hours * 100) / NULLIF(planned_hours, 0) as progress,
            t.effective_hours as hours_effective,
            t.planned_hours - t.effective_hours - t.subtask_effective_hours as remaining_hours,
            NULLIF(planned_hours, 0) as hours_planned
        """

    def _from_tables(self):
        return super()._from_tables() + """
            -- used to search the manager of the task user
            LEFT JOIN hr_employee emp ON emp.user_id = t.user_id AND t.company_id = emp.company_id
            LEFT JOIN hr_employee manager ON manager.id = emp.parent_id

            -- used to search the manager of the project user
            LEFT JOIN hr_employee p_emp ON p_emp.user_id = p.user_id AND p_emp.company_id = p.company_id
            LEFT JOIN hr_employee p_manager ON p_manager.id = p_emp.parent_id
        """

    def _group_by(self):
        return super(ReportProjectTaskUser, self)._group_by() + """,
            manager.user_id,
            p_manager.user_id,
            t.overtime,
            remaining_hours,
            t.effective_hours,
            planned_hours
            """

    @api.model
    def _fields_view_get(self, view_id=None, view_type='form', toolbar=False, submenu=False):
        result = super(ReportProjectTaskUser, self)._fields_view_get(view_id=view_id, view_type=view_type, toolbar=toolbar, submenu=submenu)
        if view_type in ['pivot', 'graph'] and self.env.company.timesheet_encode_uom_id == self.env.ref('uom.product_uom_day'):
            result['arch'] = self.env['account.analytic.line']._apply_time_label(result['arch'], related_model=self._name)
        return result
