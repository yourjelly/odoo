# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, _
from odoo.exceptions import UserError


class Project(models.Model):
    _inherit = "project.project"

    is_timeoff_type_project = fields.Boolean("Is Timeoff Type Project", compute="_compute_is_timeoff_type_project")

    def _compute_is_timeoff_type_project(self):
        read_group = self.env['hr.leave.type']._read_group([('timesheet_project_id', 'in', self.ids)], ['timesheet_project_id'], ['__count'])
        timeoff_types_per_project = {project.id: count for project, count in read_group}
        timeoff_type_projects = self.filtered(lambda project: timeoff_types_per_project.get(project.id))
        timeoff_type_projects.is_timeoff_type_project = True
        (self - timeoff_type_projects).is_timeoff_type_project = False

    def write(self, values):
        print("\n\n self.is_timeoff_type_project", self.is_timeoff_type_project)
        if values.get('company_id') and self.is_timeoff_type_project and \
            self.env['hr.leave.type'].search_count([('timesheet_project_id', 'in', self.filtered('is_timeoff_type_project').ids), '|', ('company_id', '!=', values['company_id']), ('company_id', '=', False)], limit=1):
                raise UserError(_("You can't change company of projects that are set on timeoff type"))
        return super(Project, self).write(values)
