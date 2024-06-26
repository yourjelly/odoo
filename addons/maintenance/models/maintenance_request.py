from odoo import fields, models, api, _


class Task(models.Model):
    _inherit = 'project.task'
    request_date = fields.Date('Request Date', tracking=True, default=fields.Date.context_today,
                               help="Date requested for the maintenance to happen")
    is_maintenance_task = fields.Boolean(default=False, readonly=True)
    task_date = fields.Date('task Date', tracking=True, default=fields.Date.context_today,
                               help="Date tasked for the maintenance to happen")
    owner_user_id = fields.Many2one('res.users', string='Created by User', default=lambda s: s.env.uid)
    category_id = fields.Many2one('maintenance.equipment.category', related='equipment_id.category_id', string='Category', store=True, readonly=True)
    equipment_id = fields.Many2one('maintenance.equipment', string='Equipment',
                                   ondelete='restrict', index=True, check_company=True)
    user_id = fields.Many2one('res.users', string='Technician', compute='_compute_user_id', store=True, readonly=False, tracking=True)
    maintenance_type = fields.Selection([('corrective', 'Corrective'), ('preventive', 'Preventive')], string='Maintenance Type', default="corrective")
    close_date = fields.Date('Close Date', help="Date the maintenance was finished. ")
    schedule_date = fields.Datetime('Scheduled Date', related='date_deadline', help="Date the maintenance team plans the maintenance.  It should not differ much from the task Date. ", readonly=False)
    duration = fields.Float(help="Duration in hours.")
    done = fields.Boolean(related='stage_id.done')
    instruction_type = fields.Selection([
        ('pdf', 'PDF'), ('google_slide', 'Google Slide'), ('text', 'Text')],
        string="Instruction", default="text"
    )
    instruction_pdf = fields.Binary('PDF')
    instruction_google_slide = fields.Char('Google Slide', help="Paste the url of your Google Slide. Make sure the access to the document is public.")
    instruction_text = fields.Html('Text')

    @property
    def SELF_READABLE_FIELDS(self):
        return super().SELF_READABLE_FIELDS | {'is_maintenance_task'}

    @property
    def SELF_WRITABLE_FIELDS(self):
        return super().SELF_WRITABLE_FIELDS | {'close_date'}

    def action_archive(self):
        self.write({'active': False, 'recurring_task': False})
        return super().action_archive()

    def reset_equipment_task(self):
        """ Reinsert the maintenance task into the maintenance pipe in the first stage"""
        first_stage_obj = self.env['project.task.type'].search([], order="sequence asc", limit=1)
        self.write({'active': True, 'stage_id': first_stage_obj.id})

    @api.depends('company_id', 'equipment_id')
    def _compute_user_id(self):
        for task in self:
            if task.equipment_id:
                task.user_id = task.equipment_id.technician_user_id or task.equipment_id.category_id.technician_user_id
            if task.user_id and task.company_id.id not in task.user_id.company_ids.ids:
                task.user_id = False

    def _get_default_project_id(self):
        Project = self.env['project.project']
        project = Project.search([('is_maintenance_project', '=', True), ('company_id', '=', self.env.company.id)], limit=1)
        if not project:
            project = Project.search([('is_maintenance_project', '=', True)], limit=1)
        return project.id

    def _creation_subtype(self):
        return self.env.ref('maintenance.mt_req_created') if self.is_maintenance_task else super()._creation_subtype()

    def _track_subtype(self, init_values):
        self.ensure_one()
        if self.is_maintenance_task and 'stage_id' in init_values:
            return self.env.ref('maintenance.mt_req_status')
        return super()._track_subtype(init_values)

    @api.model_create_multi
    def create(self, vals_list):
        # context: no_log, because subtype already handle this
        if self.env.context.get('default_is_maintenance_task'):
            for vals in vals_list:
                vals['is_maintenance_task'] = True

        for vals in vals_list:
            if not vals.get('is_maintenance_task'):
                continue
            if not vals.get('company_id'):
                vals['company_id'] = self.env.company.id
            if not vals.get('project_id'):
                vals['project_id'] = self._get_default_project_id()
            if 'maintenance_type' in vals and vals['maintenance_type'] != 'preventive':
                vals['recurring_task'] = False

        tasks = super().create(vals_list)
        for task in tasks:
            if not task.is_maintenance_task:
                continue
            if task.owner_user_id or task.user_id:
                task._add_followers()
            if task.equipment_id and not task.project_id:
                task.project_id = task.equipment_id.project_id
            if task.close_date and not task.stage_id.done:
                task.close_date = False
            if not task.close_date and task.stage_id.done:
                task.close_date = fields.Date.today()
        tasks.activity_update()
        return tasks

    def write(self, vals):
        if 'maintenance_type' in vals and vals['maintenance_type'] != 'preventive':
            vals['recurring_task'] = False
        maintenance_tasks = self.filtered(lambda m: m.is_maintenance_task)
        for task in maintenance_tasks:
            if 'stage_id' in vals and task.maintenance_type == 'preventive' and task.recurring_task and self.env['project.task.type'].browse(vals['stage_id']).done:
                vals['state'] = '1_done'
        res = super().write(vals)
        if vals.get('owner_user_id') or vals.get('user_id'):
            maintenance_tasks._add_followers()
        if 'stage_id' in vals:
            maintenance_tasks.filtered(lambda m: m.stage_id.done).write({'close_date': fields.Date.today()})
            maintenance_tasks.filtered(lambda m: not m.stage_id.done).write({'close_date': False})
            maintenance_tasks.activity_feedback(['maintenance.mail_act_maintenance_task'])
            maintenance_tasks.activity_update()
        if vals.get('user_id') or vals.get('schedule_date'):
            maintenance_tasks.activity_update()
        if maintenance_tasks._need_new_activity(vals):
            # need to change description of activity also so unlink old and create new activity
            maintenance_tasks.activity_unlink(['maintenance.mail_act_maintenance_task'])
            maintenance_tasks.activity_update()
        return res

    def _need_new_activity(self, vals):
        return vals.get('equipment_id')

    def _get_activity_note(self):
        self.ensure_one()
        if self.equipment_id:
            return _('task planned for %s', self.equipment_id._get_html_link())
        return False

    def activity_update(self):
        """ Update maintenance activities based on current record set state.
        It reschedule, unlink or create maintenance task activities. """
        self.filtered(lambda task: not task.schedule_date).activity_unlink(['maintenance.mail_act_maintenance_task'])
        for task in self.filtered(lambda task: task.schedule_date):
            date_dl = fields.Datetime.from_string(task.schedule_date).date()
            updated = task.activity_reschedule(
                ['maintenance.mail_act_maintenance_task'],
                date_deadline=date_dl,
                new_user_id=task.user_id.id or task.owner_user_id.id or self.env.uid)
            if not updated:
                note = task._get_activity_note()
                task.activity_schedule(
                    'maintenance.mail_act_maintenance_task',
                    fields.Datetime.from_string(task.schedule_date).date(),
                    note=note, user_id=task.user_id.id or task.owner_user_id.id or self.env.uid)

    def _add_followers(self):
        for task in self:
            partner_ids = (task.owner_user_id.partner_id + task.user_id.partner_id).ids
            task.message_subscribe(partner_ids=partner_ids)
