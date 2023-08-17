from odoo import models, fields, api

class CalendarEventPublic(models.Model):
    _name = "calendar.event"
    _description = "Calendar Event"
    _auto = False
    _order = 'id desc'

    # See with ORM why not add public fields here :/
    @property
    def _table_query(self):
        # Adding fields for searchability
        return f"""
        WITH available_events AS ({self._available_events_query()})
        {self._available_events_data_query()}
        UNION
        {self._hidden_events_data_query()}
        """

    def _available_events_query(self):
        pid = self.env.user.partner_id.id
        return f"""
        SELECT DISTINCT id
        FROM    calendar_event_private p
        JOIN    calendar_event_private_res_partner_rel rel
        ON      p.id = rel.calendar_event_private_id
        WHERE   p.partner_id = {pid}
        OR      rel.res_partner_id = {pid}
        """


    def _available_events_data_query(self):
        return """
        SELECT 
            id,
            id as private_id,
            start,
            stop,
            is_public,
            partner_id
        FROM calendar_event_private
        WHERE id IN (
            SELECT * FROM available_events
        )
        """

    def _hidden_events_data_query(self):
        return """
        SELECT 
            hashtext(id::varchar || '_' || rel.res_partner_id::varchar),
            NULL AS private_id,
            start,
            stop,
            is_public,
            rel.res_partner_id AS partner_id
        FROM calendar_event_private p
        JOIN calendar_event_private_res_partner_rel rel
        ON   p.id = rel.calendar_event_private_id
        WHERE p.id NOT IN (
            SELECT * FROM available_events
        )
        """

        ####################
        # Technical fields #
        ####################
    private_id = fields.Many2one('calendar.event.private', default=lambda self:self.id)
    can_read_private = fields.Boolean(compute='_compute_access', default=True)
    can_write = fields.Boolean(compute='_compute_access', default=True)

    def _has_access(self, access):
        self.ensure_one()
        if isinstance(self.id, models.NewId): return True
        if not self.private_id: return False
        try:
            self.private_id.check_access_rights(access)
            self.private_id.check_access_rule(access)
            return True
        except:  # TODO MAKE MORE RESTRICTIVE
            return False

    @api.depends_context('uid')
    @api.depends('private_id')
    def _compute_access(self):
        for event in self:
            event.can_read_private = event.is_public or event._has_access('read')
            event.can_write = event._has_access('write')

    @api.model_create_multi
    def create(self, vals):
        events = self.env['calendar.event.private'].create(vals)
        return self.browse(events.ids)

        ##################
        # Related fields #
        ##################

    start = fields.Datetime('Start Date', compute='_compute_start', compute_sudo=True, default=0, inverse='_inverse_start', required=True, store=True)
    stop = fields.Datetime('End Date', compute='_compute_stop', compute_sudo=True, inverse='_inverse_stop', required=True, store=True)
    duration = fields.Integer('Duration in Hours', compute='_compute_duration', compute_sudo=True, inverse='_inverse_duration')
    is_public = fields.Boolean(compute='_compute_is_public', compute_sudo=True, default=False, inverse='_inverse_is_public', store=True)
    partner_id = fields.Many2one('res.partner', compute='_compute_partner_id', compute_sudo=True, store=True,
                                 default=lambda self:self.env.user.partner_id, inverse='_inverse_partner_id', string='Owner')
    attendee_ids = fields.Many2many('res.partner', compute='_compute_attendee_ids', compute_sudo=False,
                                    default=lambda self:self.env.user.partner_id, inverse='_inverse_attendee_ids')
    name = fields.Char(compute='_compute_name', compute_sudo=False, inverse='_inverse_name')
    display_name = fields.Char(compute='_compute_display_name', compute_sudo=False, inverse='_inverse_display_name')
    note = fields.Char(compute='_compute_note', compute_sudo=False, inverse='_inverse_note')

    @api.depends('private_id.start')
    def _compute_start(self):
        for event in self:
            event.start = event.private_id.start

    def _inverse_start(self):
        for event in self:
            event.private_id.start = event.start

    @api.depends('private_id.stop')
    def _compute_stop(self):
        for event in self:
            event.stop = event.private_id.stop

    def _inverse_stop(self):
        for event in self:
            event.private_id.stop = event.stop

    @api.depends('private_id.duration')
    def _compute_duration(self):
        for event in self:
            event.duration = event.private_id.duration

    def _inverse_duration(self):
        for event in self:
            event.private_id.duration = event.duration

    @api.depends('private_id.is_public')
    def _compute_is_public(self):
        for event in self:
            event.is_public = event.private_id.is_public

    def _inverse_is_public(self):
        for event in self:
            event.private_id.is_public = event.is_public

    @api.depends('private_id.partner_id')
    def _compute_partner_id(self):
        for event in self:
            event.partner_id = event.private_id.partner_id

    def _inverse_partner_id(self):
        for event in self:
            event.private_id.partner_id = event.partner_id

    @api.depends('private_id.attendee_ids')
    @api.depends_context('uid')
    def _compute_attendee_ids(self):
        for event in self:
            event.attendee_ids = event.can_read_private and event.private_id.attendee_ids

    def _inverse_attendee_ids(self):
        for event in self:
            event.private_id.attendee_ids = event.attendee_ids

    @api.depends('private_id.name')
    @api.depends_context('uid')
    def _compute_name(self):
        for event in self:
            event.name = event.can_read_private and event.private_id.name or 'Busy'

    def _inverse_name(self):
        for event in self:
            event.private_id.name = event.name

    @api.depends('private_id.display_name')
    @api.depends_context('uid')
    def _compute_display_name(self):
        for event in self:
            event.display_name = event.can_read_private and event.private_id.display_name or 'Busy'

    @api.depends('private_id.note')
    @api.depends_context('uid')
    def _compute_note(self):
        for event in self:
            event.note = event.can_read_private and event.private_id.note

    def _inverse_note(self):
        for event in self:
            event.private_id.note = event.note