# -*- coding: utf-8 -*-
from openerp import api, models


class CalendarEvent(models.Model):
    """ Model for Calendar Event """
    _inherit = 'calendar.event'

    @api.model
    def create(self, vals):
        res = super(CalendarEvent, self).create(vals)
        if self.env.context.get('active_model') == 'hr_evaluation.evaluation':
            evaluation = self.env['hr_evaluation.evaluation'].browse(self.env.context.get('active_id'))
            evaluation.log_meeting(res.name, res.start)
            evaluation.write({'meeting_id': res.id, 'interview_deadline': res.start_date if res.allday else res.start_datetime})
        return res
