# -*- coding: utf-8 -*-
import calendar
import datetime
import uuid
import urlparse
from dateutil import parser
from dateutil.relativedelta import relativedelta

from openerp import api, fields, models, tools, _
from openerp.exceptions import UserError


class HrEvaluation(models.Model):
    _name = "hr_evaluation.evaluation"
    _inherit = ['mail.thread']
    _description = "Employee Appraisal"
    _order = 'date_close, interview_deadline'

    _track = {
        'state': {
            'hr_evaluation.mt_appraisal_new': lambda self, cr, uid, obj, ctx = None: obj.state == 'new',
        }
    }
    EVALUATION_STATE = [
        ('new', 'To Start'),
        ('pending', 'Appraisal Sent'),
        ('done', 'Done')
    ]

    def _compute_number_of_survey(self):
        return self.env['survey.user_input'].search([
            ('survey_id', 'in', [self.appraisal_manager_survey_id.id, self.appraisal_colleagues_survey_id.id, self.appraisal_self_survey_id.id, self.appraisal_subordinates_survey_id.id]),
            ('type', '=', 'link'), ('evaluation_id', '=', self.id)])

    @api.one
    @api.depends('state', 'interview_deadline')
    def _compute_tot_sent_survey(self):
        self.tot_sent_survey = len(self._compute_number_of_survey())

    @api.one
    @api.depends(
        'appraisal_manager_survey_id.user_input_ids.state',
        'appraisal_colleagues_survey_id.user_input_ids.state',
        'appraisal_self_survey_id.user_input_ids.state',
        'appraisal_subordinates_survey_id.user_input_ids.state'
    )
    def _compute_tot_completed_appraisal(self):
        self.tot_comp_survey = len(self._compute_number_of_survey().filtered(lambda r: r.state == 'done'))

    employee_id = fields.Many2one('hr.employee', required=True, string='Employee', index=True)
    department_id = fields.Many2one(comodel_name='hr.department', related='employee_id.department_id', string='Department')
    note_action = fields.Text(string='Action Plan', help="If the evaluation does not meet the expectations, you can propose an action plan")
    state = fields.Selection(EVALUATION_STATE, string='Status', track_visibility='onchange', required=True, readonly=True, copy=False, default='new', index=True)
    appraisal_manager_ids = fields.Many2many('hr.employee', 'evaluation_appraisal_manager_rel', 'hr_evaluation_evaluation_id')
    appraisal_colleagues = fields.Boolean(string='Colleagues')
    appraisal_manager = fields.Boolean(string='Manager')
    appraisal_subordinates = fields.Boolean(string='Collaborator')
    appraisal_self = fields.Boolean(string='Employee')
    appraisal_colleagues_ids = fields.Many2many('hr.employee', 'evaluation_appraisal_colleagues_rel', 'hr_evaluation_evaluation_id')
    appraisal_employee = fields.Char(related='employee_id.name', string='Employee Name')
    appraisal_subordinates_ids = fields.Many2many('hr.employee', 'evaluation_appraisal_subordinates_rel', 'hr_evaluation_evaluation_id')
    tot_sent_survey = fields.Integer(string='Number of Sent Survey', compute='_compute_tot_sent_survey')
    tot_comp_survey = fields.Integer(string='Number of completed Survey', compute="_compute_tot_completed_appraisal", store=True)
    mail_template_id = fields.Many2one('mail.template', string="Email Template For Appraisal", default=lambda self: self.env.ref('hr_evaluation.email_template_appraisal'))
    color = fields.Integer(string='Color Index')
    meeting_id = fields.Many2one('calendar.event', string='Meeting')
    interview_deadline = fields.Date(string="Final Interview", index=True)
    date_close = fields.Datetime(string='Appraisal Deadline', index=True, required=True)
    appraisal_manager_survey_id = fields.Many2one('survey.survey', string='Manager Appraisal', required=False)
    appraisal_colleagues_survey_id = fields.Many2one('survey.survey', string="Employee's Appraisal")
    appraisal_self_survey_id = fields.Many2one('survey.survey', string='Self Appraisal')
    appraisal_subordinates_survey_id = fields.Many2one('survey.survey', string="collaborate's Appraisal")
    company_id = fields.Many2one('res.company', string='Company', default=lambda self: self.env.user.company_id)

    @api.onchange('employee_id')
    def onchange_employee_id(self):
        if self.employee_id:
            self.department_id = self.employee_id.department_id
            self.appraisal_manager = self.employee_id.appraisal_manager
            self.appraisal_manager_ids = self.employee_id.appraisal_manager_ids
            self.appraisal_manager_survey_id = self.employee_id.appraisal_manager_survey_id
            self.appraisal_colleagues = self.employee_id.appraisal_colleagues
            self.appraisal_colleagues_ids = self.employee_id.appraisal_colleagues_ids
            self.appraisal_colleagues_survey_id = self.employee_id.appraisal_colleagues_survey_id
            self.appraisal_self = self.employee_id.appraisal_self
            self.appraisal_self_survey_id = self.employee_id.appraisal_self_survey_id
            self.appraisal_subordinates = self.employee_id.appraisal_subordinates
            self.appraisal_subordinates_ids = self.employee_id.appraisal_subordinates_ids
            self.appraisal_subordinates_survey_id = self.employee_id.appraisal_subordinates_survey_id

    @api.one
    @api.constrains('employee_id', 'department_id', 'date_close')
    def _check_employee_appraisal_duplication(self):
        """ Avoid duplication"""
        if self.employee_id and self.department_id and self.date_close:
            date_closed = fields.Datetime.from_string(self.date_close)
            start_datetime = date_closed.replace(day=1)
            end_datetime = date_closed.replace(day=calendar.monthrange(date_closed.year, date_closed.month)[1])
            appraisals = self.search([
                ('employee_id', '=', self.employee_id.id), ('department_id', '=', self.department_id.id),
                ('date_close', '<=', fields.Datetime.to_string(end_datetime)),
                ('date_close', '>=', fields.Datetime.to_string(start_datetime))])
            if len(appraisals) > 1:
                raise UserError(_("You cannot create more than one appraisal for same Month & Year"))

    def _subscribe_users(self):
        user_ids = [emp.user_id.id for emp in self.appraisal_manager_ids if emp.user_id]
        if self.employee_id.user_id:
            user_ids.append(self.employee_id.user_id.id)
        if self.employee_id.department_id.manager_id.user_id:
            user_ids.append(self.employee_id.department_id.manager_id.user_id.id)
        if self.employee_id.parent_id.user_id:
            user_ids.append(self.employee_id.parent_id.user_id.id)
        return self.message_subscribe_users(user_ids=user_ids)

    @api.model
    def create(self, vals):
        result = super(HrEvaluation, self.with_context(mail_create_nolog=True)).create(vals)
        if result.appraisal_manager_ids:
            result._subscribe_users()
        return result

    @api.multi
    def write(self, vals):
        Employee = self.env['hr.employee']
        result = super(HrEvaluation, self).write(vals)
        for eval_record in self:
            if vals.get('state') == 'pending' and not vals.get('send_mail_status'):
                eval_record.button_send_appraisal()
            if vals.get('interview_deadline') and eval_record.state == 'pending' and not vals.get('meeting_id'):
                # creating employee meeting and interview date
                eval_record.create_update_meeting(vals)
            if vals.get('appraisal_manager_ids'):
                # add followers
                user_ids = [employee.user_id.id for employee in Employee.browse(vals['appraisal_manager_ids'][0][2]) if employee.user_id]
                eval_record.message_subscribe_users(user_ids)
        return result

    def create_token(self, email, survey, partner):
        """ Create response with token """
        token = uuid.uuid4().__str__()
        self.env['survey.user_input'].create({
            'survey_id': survey.id,
            'deadline': self.date_close,
            'date_create': fields.Date.to_string(datetime.datetime.now()),
            'type': 'link',
            'state': 'new',
            'token': token,
            'evaluation_id': self.id,
            'partner_id': partner.id,
            'email': email})
        return token

    def send_appraisal(self, appraisal_receiver):
        MailThread = self.env['mail.thread']
        MailTemplate = self.env['mail.template']
        for record in appraisal_receiver:
            for employee in record['employee_ids']:
                email = tools.email_split(employee.work_email) and tools.email_split(employee.work_email)[0] or False
                if email:
                    partner = MailThread._find_partner_from_emails(email) or employee.user_id.partner_id
                    if not partner:
                        raise UserError(_("Employee do not have configured partner_id."))
                    token = self.create_token(email, record['survey_id'], partner)
                    survey_url = urlparse.urlparse(record['survey_id'].public_url).path[1:]
                    if token:
                        survey_url = survey_url + '/' + token
                    render_template = MailTemplate.with_context(email=email, appraisal_url=survey_url, title=record['survey_id'].title).generate_email_batch(self.mail_template_id.id, [self.id])
                    self.message_post(
                        body=render_template[self.id]['body'],
                        model='hr_evaluation.evaluation',
                        type='email',
                        partner_ids=[partner.id]
                    )
        return True

    def send_survey_to_employee(self, appraisal_receiver):
        """ Create one mail by recipients and __URL__ by link with identification token """
        find_no_email = set(employee.name for record in appraisal_receiver for employee in record['employee_ids'] if not employee.work_email)
        if find_no_email:
            raise UserError(_("Following employees do not have configured an email address. \n- %s") % ('\n- ').join(find_no_email))
        self.send_appraisal(appraisal_receiver)
        return True

    @api.multi
    def button_send_appraisal(self):
        """ Changes To Start state to Appraisal Sent."""
        self.ensure_one()
        if self.employee_id:
            appraisal_receiver = []
            if not self.interview_deadline:
                self.interview_deadline = self.date_close
            if self.appraisal_manager and self.appraisal_manager_ids:
                appraisal_receiver.append({'survey_id': self.appraisal_manager_survey_id, 'employee_ids': self.appraisal_manager_ids})
            if self.appraisal_colleagues and self.appraisal_colleagues_ids:
                appraisal_receiver.append({'survey_id': self.appraisal_colleagues_survey_id, 'employee_ids': self.appraisal_colleagues_ids})
            if self.appraisal_subordinates and self.appraisal_subordinates_ids:
                appraisal_receiver.append({'survey_id': self.appraisal_subordinates_survey_id, 'employee_ids': self.appraisal_subordinates_ids})
            if self.appraisal_self and self.appraisal_employee:
                appraisal_receiver.append({'survey_id': self.appraisal_self_survey_id, 'employee_ids': self.employee_id})
            if appraisal_receiver:
                self.send_survey_to_employee(appraisal_receiver)
            else:
                raise UserError(_("Employee do not have configured evaluation plan."))
            if self.state == 'new':
                self.write({'state': 'pending', 'send_mail_status': True})
        return True

    @api.multi
    def button_done_appraisal(self):
        """ Changes Appraisal Sent state to Done."""
        return self.write({'state': 'done'})

    def create_update_meeting(self, vals):
        """ Creates event when user enters date manually from the form view.
            If users edits the already entered date, created meeting is updated accordingly.
        """
        interview_deadline = vals.get('interview_deadline')
        if self.meeting_id and self.meeting_id.allday:
            self.meeting_id.write({'start_date': interview_deadline, 'stop_date': interview_deadline})
        elif self.meeting_id and not self.meeting_id.allday:
            date = fields.Date.from_string(interview_deadline)
            meeting_date = fields.Datetime.to_string(date)
            self.meeting_id.write({'start_datetime': meeting_date, 'stop_datetime': meeting_date})
        else:
            partner_ids = [(4, manager.user_id.partner_id.id) for manager in self.appraisal_manager_ids if manager.user_id]
            if self.employee_id.user_id:
                partner_ids.append((4, self.employee_id.user_id.partner_id.id))
            self.meeting_id = self.env['calendar.event'].create({
                'name': _('Appraisal Meeting For ') + self.employee_id.name_related,
                'start': interview_deadline,
                'stop': interview_deadline,
                'allday': True,
                'partner_ids': partner_ids,
            })
        return self.log_meeting(self.meeting_id.name, self.meeting_id.start)

    @api.multi
    def name_get(self):
        result = []
        for evaluation in self:
            result.append((evaluation.id, '%s' % (evaluation.employee_id.name_related)))
        return result

    @api.multi
    def unlink(self):
        for appraisal in self:
            if appraisal.state != 'new':
                eval_state = dict(self.EVALUATION_STATE)
                raise UserError(_("You cannot delete appraisal which is in '%s' state") % (eval_state[appraisal.state]))
        return super(HrEvaluation, self).unlink()

    @api.v7
    def read_group(self, cr, uid, domain, fields, groupby, offset=0, limit=None, context=None, orderby=False, lazy=True):
        """ Override read_group to always display all states. """
        if groupby and groupby[0] == "state":
            states = self.EVALUATION_STATE
            read_group_all_states = [{
                '__context': {'group_by': groupby[1:]},
                '__domain': domain + [('state', '=', state_value)],
                'state': state_value,
            } for state_value, state_name in states]
            read_group_res = super(HrEvaluation, self).read_group(cr, uid, domain, fields, groupby, offset, limit, context, orderby, lazy)
            result = []
            for state_value, state_name in states:
                res = filter(lambda x: x['state'] == state_value, read_group_res)
                if not res:
                    res = filter(lambda x: x['state'] == state_value, read_group_all_states)
                result.append(res[0])
            return result
        else:
            return super(HrEvaluation, self).read_group(cr, uid, domain, fields, groupby, offset=offset, limit=limit, context=context, orderby=orderby, lazy=lazy)

    def get_appraisal(self):
        survey = self.env['survey.user_input'].search([('survey_id', 'in', [
            self.appraisal_manager_survey_id.id, self.appraisal_colleagues_survey_id.id,
            self.appraisal_self_survey_id.id, self.appraisal_subordinates_survey_id.id]),
            ('type', '=', 'link'), ('evaluation_id', '=', self.id)])
        action = self.env.ref('survey.action_survey_user_input').read()[0]
        return survey, action

    @api.multi
    def action_get_sent_survey(self):
        """ Link to open sent appraisal"""
        self.ensure_one()
        survey, action = self.get_appraisal()
        sent_survey_ids = [survey_record.id for survey_record in survey]
        action['domain'] = str([('id', 'in', sent_survey_ids)])
        return action

    @api.multi
    def action_get_answer_survey(self):
        """ Link to open answers appraisal"""
        self.ensure_one()
        survey, action = self.get_appraisal()
        ans_survey_ids = [survey_record.id for survey_record in survey.filtered(lambda r: r.state == 'done')]
        action['domain'] = str([('id', 'in', ans_survey_ids)])
        return action

    @api.multi
    def schedule_interview_date(self):
        """ Link to open calendar view for creating employee interview and meeting"""
        self.ensure_one()
        partner_ids = []
        partner_ids = [manager.user_id.partner_id.id for manager in self.appraisal_manager_ids if manager.user_id]
        if self.employee_id.user_id:
            partner_ids.append(self.employee_id.user_id.partner_id.id)
        action = self.env.ref('calendar.action_calendar_event').read()[0]
        partner_ids.append(self.env.user.partner_id.id)
        action['context'] = {
            'default_partner_ids': partner_ids
        }
        meetings = self.env['calendar.event'].search([('partner_ids', 'in', partner_ids)])
        action['domain'] = str([('id', 'in', meetings.ids)])
        return action

    def log_meeting(self, meeting_subject, meeting_date):
        message_receiver = []
        if self.appraisal_manager and self.appraisal_manager_ids:
            message_receiver.append({'survey_id': self.appraisal_manager_survey_id, 'employee_ids': self.appraisal_manager_ids})
        if self.appraisal_self and self.appraisal_employee:
            message_receiver.append({'survey_id': self.appraisal_self_survey_id, 'employee_ids': self.employee_id})
        partner_ids = [emp.user_id.partner_id.id for record in message_receiver for emp in record['employee_ids'] if emp.user_id]
        message = _("Subject: %s <br> Meeting scheduled at '%s'<br>") % (meeting_subject, meeting_date.split(' ')[0])
        return self.message_post(body=message, partner_ids=partner_ids)


class HrEmployee(models.Model):
    _inherit = "hr.employee"

    @api.one
    def _appraisal_count(self):
        self.appraisal_count = self.env['hr_evaluation.evaluation'].search_count([('employee_id', '=', self.id)])

    evaluation_date = fields.Date(string='Next Appraisal Date', help="The date of the next appraisal is computed by the appraisal plan's dates (first appraisal + periodicity).")
    appraisal_manager = fields.Boolean(string='Manager')
    appraisal_manager_ids = fields.Many2many('hr.employee', 'appraisal_manager_rel', 'hr_evaluation_evaluation_id')
    appraisal_manager_survey_id = fields.Many2one('survey.survey', string='Manager Appraisal')
    appraisal_colleagues = fields.Boolean(string='Colleagues')
    appraisal_colleagues_ids = fields.Many2many('hr.employee', 'appraisal_colleagues_rel', 'hr_evaluation_evaluation_id')
    appraisal_colleagues_survey_id = fields.Many2one('survey.survey', string="Employee's Appraisal")
    appraisal_self = fields.Boolean(string='Employee')
    appraisal_employee = fields.Char(string='Employee Name')
    appraisal_self_survey_id = fields.Many2one('survey.survey', string='Self Appraisal')
    appraisal_subordinates = fields.Boolean(string='Collaborator')
    appraisal_subordinates_ids = fields.Many2many('hr.employee', 'appraisal_subordinates_rel', 'hr_evaluation_evaluation_id')
    appraisal_subordinates_survey_id = fields.Many2one('survey.survey', string="collaborate's Appraisal")
    appraisal_repeat = fields.Boolean(string='Periodic Appraisal', default=False)
    appraisal_repeat_number = fields.Integer(string='Repeat Every', default=1)
    appraisal_repeat_delay = fields.Selection([('year', 'Year'), ('month', 'Month')], string='Repeat Every', copy=False, default='year')
    appraisal_count = fields.Integer(compute='_appraisal_count', string='Appraisal Interviews')

    @api.onchange('appraisal_manager', 'parent_id')
    def onchange_manager_appraisal(self):
        if self.appraisal_manager:
            self.appraisal_manager_ids = [self.parent_id.id]

    @api.onchange('appraisal_self')
    def onchange_self_employee(self):
        self.appraisal_employee = self.name

    @api.onchange('appraisal_colleagues')
    def onchange_colleagues(self):
        if self.department_id.id:
            self.appraisal_colleagues_ids = self.search([('department_id', '=', self.department_id.id), ('parent_id', '!=', False)])

    @api.onchange('appraisal_subordinates')
    def onchange_subordinates(self):
        self.appraisal_subordinates_ids = self.search([('parent_id', '!=', False)]).mapped('parent_id')

    @api.model
    def run_employee_evaluation(self, automatic=False, use_new_cursor=False):  # cronjob
        now = parser.parse(fields.Date.to_string(datetime.datetime.now()))
        next_date = datetime.datetime.now()
        for employee in self.search([('evaluation_date', '<=', fields.Datetime.to_string(datetime.datetime.now()))]):
            if employee.appraisal_repeat_delay == 'month':
                next_date = fields.Date.to_string(now + relativedelta(months=employee.appraisal_repeat_number))
            else:
                next_date = fields.Date.to_string(now + relativedelta(months=employee.appraisal_repeat_number * 12))
            employee.write({'evaluation_date': next_date})
            vals = {'employee_id': employee.id,
                    'date_close': fields.Datetime.to_string(datetime.datetime.now()),
                    'appraisal_manager': employee.appraisal_manager,
                    'appraisal_manager_ids': [(4, manager.id) for manager in employee.appraisal_manager_ids] or [(4, employee.parent_id.id)],
                    'appraisal_manager_survey_id': employee.appraisal_manager_survey_id.id,
                    'appraisal_colleagues': employee.appraisal_colleagues,
                    'appraisal_colleagues_ids': [(4, colleagues.id) for colleagues in employee.appraisal_colleagues_ids],
                    'appraisal_colleagues_survey_id': employee.appraisal_colleagues_survey_id.id,
                    'appraisal_self': employee.appraisal_self,
                    'appraisal_employee': employee.appraisal_employee or employee.name,
                    'appraisal_self_survey_id': employee.appraisal_self_survey_id.id,
                    'appraisal_subordinates': employee.appraisal_subordinates,
                    'appraisal_subordinates_ids': [(4, subordinates.id) for subordinates in employee.appraisal_subordinates_ids],
                    'appraisal_subordinates_survey_id': employee.appraisal_subordinates_survey_id.id}
            self.env['hr_evaluation.evaluation'].create(vals)
        return True
