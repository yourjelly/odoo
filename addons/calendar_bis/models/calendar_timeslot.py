from odoo import models, fields, api, _, Command
from dateutil.relativedelta import relativedelta
from ..util import RRULE


class CalendarTimeslot(models.Model):
    _name = "calendar.timeslot"
    _description = "Calendar Timeslot"
    _order = "start desc, id"

    # Technical Fields
    event_id = fields.Many2one('calendar.event.private', default=lambda self: self.env['calendar.event.private'].create([{}]).id)
    can_read_private = fields.Boolean(compute='_compute_access', default=True)
    can_write = fields.Boolean(compute='_compute_access', default=True)
    active = fields.Boolean(default=True)

    # Time Related Fields
    start = fields.Datetime(default=fields.Datetime.now, required=True)
    stop = fields.Datetime(required=True, compute='_compute_stop', readonly=False, store=True)
    duration = fields.Float('Duration', compute='_compute_duration', store=True, readonly=False, default=0.5)

    # Attendee Fields
    attendee_ids = fields.One2many('calendar.attendee', 'timeslot_id')

    # Event Related Fields
    is_public = fields.Boolean(related='event_id.is_public', default=False, readonly=False)
    partner_id = fields.Many2one('res.partner', related='event_id.partner_id', string='Owner')

    name = fields.Char(compute='_compute_name', inverse='_inverse_name')
    note = fields.Char(compute='_compute_note', inverse='_inverse_note')

    # rrule UX                      # TODO maybe move to event to compute only once?
    is_recurrent = fields.Boolean('Is recurrent', related='event_id.is_recurrent', related_sudo=False)
    mo = fields.Boolean('Monday', related='event_id.mo', related_sudo=False)
    tu = fields.Boolean('Tuesday', related='event_id.tu', related_sudo=False)
    we = fields.Boolean('Wednesday', related='event_id.we', related_sudo=False)
    th = fields.Boolean('Thursday', related='event_id.th', related_sudo=False)
    fr = fields.Boolean('Friday', related='event_id.fr', related_sudo=False)
    sa = fields.Boolean('Saturday', related='event_id.sa', related_sudo=False)
    su = fields.Boolean('Sunday', related='event_id.su', related_sudo=False)
    freq = fields.Selection('Frequency', related='event_id.freq', related_sudo=False)
    until = fields.Datetime('End Date', related='event_id.until', related_sudo=False)
    count = fields.Integer('Count', related='event_id.count', related_sudo=False)
    dtstart = fields.Datetime('Start Date', related='event_id.dtstart', related_sudo=False)
    interval = fields.Integer('Interval', related='event_id.interval', related_sudo=False)
    monthday = fields.Integer('Nth of the month',related='event_id.monthday', related_sudo=False)   # 3rd of the month
    monthweekday_n = fields.Integer('Weekday of the month', related='event_id.monthweekday_n', related_sudo=False) # 1st Monday of the month
    monthweekday_day = fields.Selection(related='event_id.monthweekday_day', related_sudo=False)


    # ACCESS FUNCTIONS
    def _has_access(self, access):
        self.ensure_one()
        if isinstance(self.id, models.NewId): return True
        if not self.event_id: return False
        try:
            self.event_id.check_access_rights(access)
            self.event_id.check_access_rule(access)
            return True
        except:  # TODO MAKE MORE RESTRICTIVE
            return False

    @api.depends_context('uid')
    @api.depends('event_id')
    def _compute_access(self):
        for event in self:
            event.can_read_private = event.is_public or event._has_access('read')
            event.can_write = event._has_access('write')

    # COMPUTES
    @api.depends('duration')
    def _compute_stop(self):
        for event in self:
            event.stop = event.start + relativedelta(hours=event.duration)

    @api.depends('stop', 'start')
    def _compute_duration(self):
        for event in self:
            event.duration = (event.stop - event.start).total_seconds() / 3600

    def copy(self, values):
        if 'attendee_ids' not in values:
            values['attendee_ids'] = [Command.create(attendee.copy_data()) for attendee in self.attendee_ids]


    #### PRIVATE RELATED ####
    @api.depends('event_id.name')
    @api.depends_context('uid')
    def _compute_name(self):
        for event in self:
            event.name = event.event_id.name if event.can_read_private else 'Busy'

    def _inverse_name(self):
        for event in self:
            event.event_id.name = event.name

    @api.depends('event_id.note')
    @api.depends_context('uid')
    def _compute_note(self):
        for event in self:
            event.note = event.can_read_private and event.event_id.note

    def _inverse_note(self):
        for event in self:
            event.event_id.note = event.note
