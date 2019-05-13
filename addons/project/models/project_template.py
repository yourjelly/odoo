# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, _


class ProjectTemplate(models.Model):
    _name = 'project.template'
    _description = 'Project Template'

    active = fields.Boolean(default=True)
    name = fields.Char(string='Title', tracking=True, required=True, index=True)
    label_tasks = fields.Char(string='Use Tasks as', default='Tasks', help="Label used for the tasks of the project.")
    color = fields.Integer(string='Color Index')
    share_stage = fields.Boolean('Copy Stages', help="Select if we duplicate the stage, or reuse the same with the project created from the Template")

    user_id = fields.Many2one('res.users', string='Project Manager', default=lambda self: self.env.user, tracking=True)
    privacy_visibility = fields.Selection([
        ('followers', 'Visible by invited employees'),
        ('employees', 'Visible by employees'),
        ('portal', 'Visible by portal users and employees'),
    ],
                                          string='Privacy', required=True,
                                          default='portal',
                                          help="Defines the visibility of the tasks of the project:\n"
                                          "- Visible by invited employees: employees may only see the followed project and tasks.\n"
                                          "- Visible by employees: employees may see all project and tasks.\n"
                                          "- Visible by portal users and employees: employees may see everything."
                                          "   Portal users may see project and tasks followed by.\n"
                                          "   them or by someone of their company.")

    resource_calendar_id = fields.Many2one(
        'resource.calendar', string='Working Time',
        default=lambda self: self.env.user.company_id.resource_calendar_id.id,
        help="Timetable working hours to adjust the gantt diagram report")

    def action_create_project(self):
        # redirect to newly created project (form view or tasks kanban)
        project = self._create_project()
        view_form_id = self.env.ref('project.edit_project').id
        action = {
            'res_id': project.id,
            'type': 'ir.actions.act_window',
            'views': [(view_form_id, 'form')],
            'view_mode': 'form',
            'name': _('Projects'),
            'res_model': 'project.project',
            }
        return action

    def _create_project(self):
        project = self.env['project.project'].create(self._prepare_project_values())
        return project

    def _get_shared_fields(self):
        return ['name', 'label_tasks', 'color']

    def _prepare_project_values(self):
        fields = self._get_shared_fields()
        values = {field: self[field].id if isinstance(self[field], models.Model) else self[field]
                  for field in fields if self[field]}
        return values


class TaskTemplate(models.Model):
    _name = 'project.task.template'
    _description = 'Project Template'

    name = fields.Char(string='Title', tracking=True, required=True, index=True)
    color = fields.Integer(string='Color Index')
    description = fields.Html(string='Description')
    tag_ids = fields.Many2many('project.tags', string='Tags', oldname='categ_ids')
    priority = fields.Selection([
        ('0', 'Normal'),
        ('1', 'Important'),
    ], default='0', index=True, string="Priority")

    def _create_task():
        pass

    def _prepare_task_values():
        pass
