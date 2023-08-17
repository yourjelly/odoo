from odoo import models, fields, api, _, Command
from dateutil.relativedelta import relativedelta
from odoo.exceptions import UserError

from ..util import RRULE

RECURRING_FIELD = {'freq', 'until', 'count', 'dtstart', 'interval', 'mo', 'tu', 'we', 'th', 'fr', 'sa', 'su', 'monthday', 'monthweekday_n', 'monthweekday_day'}

class CalendarEventPrivate(models.Model):
    _name = "calendar.event.private"
    _description = "Calendar Event Private"
    _order = "id desc"
    def _valid_field_parameter(self, field, name):  # USED FOR GENERATION OF THE PUBLIC FILE, REMOVE WHEN FINALIZED
        return name in ['public', 'public_default'] or super()._valid_field_parameter(field, name)

    timeslot_ids = fields.One2many('calendar.timeslot', 'event_id')
    parent_id = fields.Many2one('calendar.event.private')
    child_ids = fields.One2many('calendar.event.private', 'parent_id')

    is_public = fields.Boolean(default=False, public=True)
    partner_id = fields.Many2one('res.partner', string="Owner", public=True, default=lambda self: self.env.user.partner_id.id)

    name = fields.Char(public_default="Busy")
    note = fields.Char()

    # Recurring fields
    is_recurrent = fields.Boolean('Is recurrent', compute='_compute_is_recurrent')
    freq = fields.Selection([('daily', 'Daily'), ('weekly', 'Weekly'), ('monthly', 'Monthly'), ('yearly', 'Yearly')], string='Frequency')
    until = fields.Datetime('End Date')
    count = fields.Integer('Count')
    dtstart = fields.Datetime('Start Date')
    interval = fields.Integer('Interval')
    # Weekly
    mo = fields.Boolean('Monday')
    tu = fields.Boolean('Tuesday')
    we = fields.Boolean('Wednesday')
    th = fields.Boolean('Thursday')
    fr = fields.Boolean('Friday')
    sa = fields.Boolean('Saturday')
    su = fields.Boolean('Sunday')
    # Monthly
    monthday = fields.Integer('Nth of the month')   # 3rd of the month
    monthweekday_n = fields.Integer('Weekday of the month') # 1st Monday of the month
    monthweekday_day = fields.Selection([
        ('mo', 'Monday'), ('tu', 'Tuesday'), ('we', 'Wednesday'),
        ('th', 'Thursday'), ('fr', 'Friday'), ('sa', 'Saturday'), ('su', 'Sunday')],
    )

    # Recurring behaviour
    @property
    def rrule(self):
        self.ensure_one()
        return RRULE.updateRRULE('', {
            'freq': self.freq,
            'until': self.until,
            'count': self.count,
            'dtstart': self.dtstart,
            'interval': self.interval,
            'mo': self.mo,
            'tu': self.tu,
            'we': self.we,
            'th': self.th,
            'fr': self.fr,
            'sa': self.sa,
            'su': self.su,
            'monthday': self.monthday,
            'monthweekday_n': self.monthweekday_n,
            'monthweekday_day': self.monthweekday_day,
        })

    @api.depends('freq')
    def _compute_is_recurrent(self):
        for event in self:
            event.is_recurrent = bool(event.freq)

    def make_timeslots(self):
        self.ensure_one()
        if not self.timeslot_ids or not (rrule := self.rrule):
            return
        copy_data = self.timeslot_ids[0].copy_data()[0]
        duration = relativedelta(hours=copy_data.get('duration', 1))
        values = [{**copy_data, 'start': x, 'stop':x+duration}
                  for x in RRULE.occurenceRRULE(rrule, copy_data.get('start'))]
        self.timeslot_ids.active = False    # TODO see how to unlink + redirect to first
        self.timeslot_ids = self.timeslot_ids.create(values)
