from odoo import fields, models, api


class Project(models.Model):
    _inherit = "project.project"

    is_maintenance_project = fields.Boolean(default=False, readonly=True)
    equipment_ids = fields.One2many('maintenance.equipment', 'project_id', copy=False)
    member_ids = fields.Many2many(
        'res.users', 'maintenance_team_users_rel', string="Team Members",
        domain="[('company_ids', 'in', company_id)]")

    # For the dashboard only
    todo_task_ids = fields.One2many('project.task', string="Requests", copy=False, compute='_compute_todo_tasks')
    todo_task_count = fields.Integer(string="Number of Requests", compute='_compute_todo_tasks')
    todo_task_count_date = fields.Integer(string="Number of Requests Scheduled", compute='_compute_todo_tasks')
    todo_task_count_high_priority = fields.Integer(string="Number of Requests in High Priority", compute='_compute_todo_tasks')
    todo_task_count_block = fields.Integer(string="Number of Requests Blocked", compute='_compute_todo_tasks')
    todo_task_count_unscheduled = fields.Integer(string="Number of Requests Unscheduled", compute='_compute_todo_tasks')

    @api.depends('task_ids.stage_id.done')
    def _compute_todo_tasks(self):
        for team in self:
            if not team.is_maintenance_project:
                team.todo_task_ids = None
                team.todo_task_count = 0
                team.todo_task_count_date = 0
                team.todo_task_count_high_priority = 0
                team.todo_task_count_block = 0
                team.todo_task_count_unscheduled = 0
                continue
            team.todo_task_ids = self.env['project.task'].search([('project_id', '=', team.id), ('stage_id.done', '=', False), ('active', '=', True)])
            data = self.env['project.task']._read_group(
                [('project_id', '=', team.id), ('stage_id.done', '=', False), ('active', '=', True)],
                ['schedule_date:year', 'priority', 'state'],
                ['__count']
            )
            team.todo_task_count = sum(count for (_, _, _, count) in data)
            team.todo_task_count_date = sum(count for (schedule_date, _, _, count) in data if schedule_date)
            team.todo_task_count_high_priority = sum(count for (_, priority, _, count) in data if priority == 1)
            team.todo_task_count_block = sum(count for (_, _, state, count) in data if state in ['02_changes_requested', '04_waiting_normal'])
            team.todo_task_count_unscheduled = team.todo_task_count - team.todo_task_count_date

    @api.depends('equipment_ids')
    def _compute_equipment(self):
        for team in self:
            if not team.is_maintenance_project:
                continue
            team.equipment_count = len(team.equipment_ids)

    @api.model_create_multi
    def create(self, vals_list):
        default_is_maintenance_project = self.env.context.get('default_is_maintenance_project', False)
        for vals in vals_list:
            if 'is_maintenance_project' not in vals:
                vals['is_maintenance_project'] = default_is_maintenance_project
            if vals.get('is_maintenance_project'):
                vals['label_tasks'] = 'Requests'
        teams = super().create(vals_list)
        maintenance_teams = teams.filtered(lambda t: t.is_maintenance_project)
        if maintenance_teams:
            for stage in self.env['project.task.type'].search([('is_maintenance_task_type', '=', True)]):
                stage.project_ids += maintenance_teams
        return teams
