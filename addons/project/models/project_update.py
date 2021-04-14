# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import timedelta
from dateutil.relativedelta import relativedelta

from odoo import api, fields, models

class ProjectUpdateStatus(models.Model):
    _name = 'project.update.status'
    _description = 'Project Update Status'
    _order = 'default desc, sequence, id'

    def _get_default_project_ids(self):
        default_project_id = self.env.context.get('default_project_id')
        return [default_project_id] if default_project_id else None

    name = fields.Char()
    color = fields.Integer()
    default = fields.Boolean()
    sequence = fields.Integer()
    project_ids = fields.Many2many('project.project', 'project_update_status_rel', 'update_status_id', 'project_id', string='Projects',
                                   default=_get_default_project_ids)

class ProjectUpdate(models.Model):
    _name = 'project.update'
    _description = 'Project Update'
    _order = 'create_date desc'
    _inherit = ['mail.thread.cc', 'mail.activity.mixin']

    def _get_default_project_id(self):
        return self.env.context.get('default_project_id') or self.env.context.get('active_id')

    def _get_default_status(self):
        project_id = self.env.context.get('default_project_id') or self.env.context.get('active_id')
        if not project_id:
            return False
        return self.env['project.update.status'].search([('project_ids', '=', project_id)], limit=1)

    def _get_default_description(self):
        project_id = self.env.context.get('default_project_id') or self.env.context.get('active_id')
        if not project_id:
            return False
        return self._build_description(project_id)

    name = fields.Char("Title", required=True)
    status_id = fields.Many2one("project.update.status", copy=False, default=_get_default_status, required=True)
    color = fields.Integer(related="status_id.color")
    progress = fields.Integer()
    progress_percentage = fields.Float(compute="_compute_progress_percentage")
    user_id = fields.Many2one('res.users', string="Author", required=True, default=lambda self: self.env.user)
    description = fields.Html(default=_get_default_description)
    date = fields.Date(default=fields.Date.context_today)
    project_id = fields.Many2one("project.project", required=True, default=_get_default_project_id)

    def _compute_progress_percentage(self):
        for u in self:
            u.progress_percentage = u.progress / 100

    # ----- ORM Override
    @api.model
    def create(self, vals):
        update = super(ProjectUpdate, self).create(vals)
        return update

    # ---------------------------------
    # Build default description
    # ---------------------------------

    @api.model
    def _build_description(self, project_id):
        template = self.env.ref('project.project_update_default_description')
        return template._render(self._get_template_values(project_id=project_id), engine='ir.qweb')

    @api.model
    def _get_template_values(self, project_id):
        return {
            'tasks': self._get_tasks_values(project_id=project_id),
            'milestones': self._get_milestone_values(project_id=project_id)
        }

    @api.model
    def _get_tasks_values(self, project_id):
        Task = self.env['project.task']
        action_url = '%s/web#menu_id=%s&action=%s&active_id=%s' % (
            self.env['ir.config_parameter'].sudo().get_param('web.base.url'),
            self.env.ref('project.menu_projects').id,
            self.env.ref('project.action_project_task_burndown_chart_report').id,
            project_id
        )
        return {
            'open_tasks': Task.search_count([('display_project_id', '=', project_id), ('stage_id.fold', '=', False), ('stage_id.is_closed', '=', False)]),
            'total_tasks': Task.search_count([('display_project_id', '=', project_id)]),
            'created_tasks': Task.search_count([('display_project_id', '=', project_id), ('create_date', '>', fields.Datetime.now() + timedelta(days=-30))]),
            'closed_tasks': self._get_last_stage_changes(project_id=project_id),
            'action': action_url,
        }

    @api.model
    def _get_last_stage_changes(self, project_id):
        query = """
            SELECT COUNT(DISTINCT pt.id) as total_updated_tasks
                  FROM mail_message mm
            INNER JOIN mail_tracking_value mtv
                    ON mm.id = mtv.mail_message_id
            INNER JOIN ir_model_fields imf
                    ON mtv.field = imf.id
                   AND imf.model = 'project.task'
                   AND imf.name = 'stage_id'
            INNER JOIN project_task_type next_stage
                    ON mtv.new_value_integer = next_stage.id
            INNER JOIN project_task pt
                    ON mm.res_id = pt.id
                   AND pt.stage_id = next_stage.id
                 WHERE mm.model = 'project.task'
                   AND mm.message_type = 'notification'
                   AND pt.display_project_id = %(project_id)s
                   AND (next_stage.fold OR next_stage.is_closed)
                   AND mm.date > (now() at time zone 'utc')::date - '1 month'::interval
                   AND pt.active
        """
        self.env.cr.execute(
            query,
            {'project_id': project_id}
        )
        results = self.env.cr.dictfetchone()
        return results and results['total_updated_tasks'] or 0

    @api.model
    def _get_milestone_values(self, project_id):
        Milestone = self.env['project.milestone']
        list_milestones = Milestone.search(
            [('project_id', '=', project_id),
             ('date_deadline', '<', fields.Date.context_today(self) + relativedelta(years=1))])._get_data_list()
        updated_milestones = self._get_last_updated_milestone(project_id=project_id)
        created_milestones = Milestone.search(
            [('project_id', '=', project_id),
             ('create_date', '>', fields.Datetime.now() + timedelta(days=-30))])._get_data_list()
        return {
            'show_section': (list_milestones or updated_milestones or created_milestones) and True or False,
            'list': list_milestones,
            'updated': updated_milestones,
            'created': created_milestones,
        }

    @api.model
    def _get_last_updated_milestone(self, project_id):
        Milestone = self.env['project.milestone']
        query = """
            SELECT DISTINCT pm.id as milestone_id,
                            FIRST_VALUE(old_value_datetime::date) OVER w_partition as old_value,
                            pm.date_deadline as new_value
                       FROM mail_message mm
                 INNER JOIN mail_tracking_value mtv
                         ON mm.id = mtv.mail_message_id
                 INNER JOIN ir_model_fields imf
                         ON mtv.field = imf.id
                        AND imf.model = 'project.milestone'
                        AND imf.name = 'date_deadline'
                 INNER JOIN project_milestone pm
                         ON mm.res_id = pm.id
                      WHERE mm.model = 'project.milestone'
                        AND mm.message_type = 'notification'
                        AND pm.project_id = %(project_id)s
                        AND mm.date > (now() at time zone 'utc')::date - '1 month'::interval
                     WINDOW w_partition AS (
                             PARTITION BY pm.id
                             ORDER BY mm.date ASC
                            );
        """
        self.env.cr.execute(
            query,
            {'project_id': project_id}
        )
        results = self.env.cr.dictfetchall()
        milestones = []
        # add computed fields
        for record in results:
            milestones.append({
                **Milestone.browse(record['milestone_id'])._get_data(),
                'new_value': record['new_value'],
                'old_value': record['old_value']
            })
        return milestones

class ProjectMilestone(models.Model):
    _name = 'project.milestone'
    _description = "Project Milestone"
    _inherit = ['mail.thread']

    def _get_default_project_id(self):
        return self.env.context.get('default_project_id') or self.env.context.get('active_id')

    name = fields.Char(required=True)
    is_done = fields.Boolean(default=False)
    date_deadline = fields.Date(tracking=True)
    is_deadline_exceeded = fields.Boolean(compute="_compute_is_deadline_exceeded")
    # we use a field but it may be done using the tracking...
    reached_date = fields.Date(compute='_compute_reached_date', store=True)
    is_date_deadline_future = fields.Boolean(compute="_compute_is_deadline_future")

    project_id = fields.Many2one('project.project', required=True, default=_get_default_project_id)

    @api.depends('is_done', 'date_deadline')
    def _compute_is_deadline_exceeded(self):
        today = fields.Date.context_today(self)
        for ms in self:
            ms.is_deadline_exceeded = not ms.is_done and ms.date_deadline and ms.date_deadline < today

    @api.depends('is_done')
    def _compute_reached_date(self):
        for ms in self:
            if ms.is_done:
                ms.reached_date = fields.Date.context_today(self)

    @api.depends('date_deadline')
    def _compute_is_deadline_future(self):
        for ms in self:
            ms.is_date_deadline_future = ms.date_deadline and ms.date_deadline > fields.Date.context_today(self)

    def mark_as_done(self, vals):
        self.write(vals)
        return self._get_data()

    @api.model
    def _get_fields_to_export(self):
        return ['id', 'name', 'is_done', 'date_deadline', 'is_deadline_exceeded', 'reached_date', 'is_date_deadline_future']

    def _get_data(self):
        self.ensure_one()
        return {field: self[field] for field in self._get_fields_to_export()}

    def _get_data_list(self):
        return [ms._get_data() for ms in self]
