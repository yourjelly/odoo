from datetime import datetime, timedelta

from odoo import models, api, fields

class calendarOccurrence(models.Model):
    _name = "calendar.occurrence"
    _description = "Reworking alarms"

    # on deletion of event also delete the entries of that event in this table
    # on creation create the cron trigger for the first alarm of the event ( if recursion for first alarm of base event only )
    #

    is_occurred = fields.Boolean(default=False)
    event_id = fields.Many2one('calendar.event')
    alarm_id = fields.Many2one('calendar.alarm')

    @api.model_create_multi
    def create(self, vals_list):
        alarm_occurrences = super().create(vals_list)

        # setting up cron triggers for the first alarm of base_event
        cron = self.env.ref('calendar.ir_cron_scheduler_alarm').sudo()
        # Check if the event has reccurrence_id, if yes check if its a base_event
        # Currently implementing for events with no recurrence
        breakpoint()
        for occurrence in alarm_occurrences:
            at = occurrence['event_id'].start - timedelta(minutes=occurrence['alarm_id'].duration_minutes)
            if at > datetime.now():
                cron._trigger(at=at)

    _sql_constraints = [
        ('event_alarm_uniq', 'unique(event_id, alarm_id)', 'An occurrence with this event and alarm already exists!'),
    ]
