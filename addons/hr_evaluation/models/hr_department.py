# -*- coding: utf-8 -*-
from openerp import api, fields, models


class hr_department(models.Model):
    _inherit = 'hr.department'

    def _compute_start_and_end_date(self):
        current_date = fields.Datetime.now()
        start_date = fields.Datetime.from_string(current_date).replace(hour=0, minute=0, second=0)
        end_date = fields.Datetime.from_string(current_date).replace(hour=23, minute=59, second=59)
        return fields.Datetime.to_string(start_date), fields.Datetime.to_string(end_date)

    @api.multi
    def _compute_interview_request(self):
        Interview = self.env['hr_evaluation.evaluation']
        start_date, end_date = self._compute_start_and_end_date()
        for department in self:
            department.interview_request_count = Interview.search_count([
                ('employee_id.department_id', '=', department.id),
                ('state', '=', 'pending'), '|', ('tot_comp_survey', '>', 0),
                ('date_close', '<=', end_date),
                ('date_close', '>=', start_date)
            ])

    @api.multi
    def _compute_appraisal_to_start(self):
        Evaluation = self.env['hr_evaluation.evaluation']
        for department in self:
            department.appraisal_to_start_count = Evaluation.search_count([
                ('employee_id.department_id', '=', department.id),
                ('state', '=', 'new')
            ])

    @api.multi
    def action_number_of_answers(self):
        action = self.env.ref('hr_evaluation.hr_appraisal_action_from_department').read()[0]
        start_date, end_date = self._compute_start_and_end_date()
        appraisal = self.env['hr_evaluation.evaluation'].search([
            ('employee_id.department_id', 'in', self.ids),
            ('state', '=', 'pending'), '|', ('tot_comp_survey', '>', 0),
            ('date_close', '<=', end_date),
            ('date_close', '>=', start_date)
        ])
        action['domain'] = str([('id', 'in', appraisal.ids)])
        return action

    appraisal_to_start_count = fields.Integer(
        compute='_compute_appraisal_to_start', string='Appraisal to Start')
    interview_request_count = fields.Integer(
        compute='_compute_interview_request', string='Interview Request')
