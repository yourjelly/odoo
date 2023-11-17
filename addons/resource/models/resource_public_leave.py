# Part of Odoo. See LICENSE file for full copyright and licensing details.

import operator as py_operator
from datetime import datetime, time
from pytz import utc

from odoo.addons.resource.models.utils import float_to_time, HOURS_SELECTION

from odoo import api, fields, models
from odoo.exceptions import ValidationError, UserError
from odoo.osv import expression
from odoo.tools.translate import _

OPERATORS = {
    '<': py_operator.lt,
    '>': py_operator.gt,
    '<=': py_operator.le,
    '>=': py_operator.ge,
    '=': py_operator.eq,
    '!=': py_operator.ne
}

class ResourcePublicLeave(models.Model):
    _name = 'resource.public.leave'
    _description = 'Public Holiday'
    _order = 'date_from desc, date_to desc'

    name = fields.Char(
        required=True)
    date_from = fields.Date(
        string='Start Date',
        required=True)
    date_to = fields.Date(
        string='End Date',
        compute='_compute_date_to',
        readonly=False,
        store=True,
        required=True)
    is_full_day = fields.Boolean(string='Is Full Day', default=True)
    hour_from = fields.Selection(HOURS_SELECTION, string='Hour from', default='0')
    hour_to = fields.Selection(HOURS_SELECTION, string='Hour to', default='24.0')
    datetime_from = fields.Datetime(compute='_compute_datetime', search='_search_datetime_from')
    datetime_to = fields.Datetime(compute='_compute_datetime', search='_search_datetime_to')
    company_ids = fields.Many2many(
        comodel_name='res.company',
        string="Companies",
        default=lambda self: self.env.company)
    allowed_calendar_ids = fields.Many2many(
        comodel_name='resource.calendar',
        compute="_compute_allowed_calendar_ids")
    resource_calendar_ids = fields.Many2many(
        comodel_name='resource.calendar',
        string='Working Hours',
        compute="_compute_calendar_ids",
        readonly=False,
        store=True,
        domain="[('id', 'in', allowed_calendar_ids)]")
    time_type = fields.Selection(
        selection=[
            ('other', 'Worked Time'),
            ('leave', 'Absence')],
        default='leave',
        string="Kind of Time Off",
        help="The distinction between working time (ex. Attendance) and absence (ex. Training) will be used in the computation of Accrual's plan rate.")

    _sql_constraints = [
        ('date_check', 'CHECK(date_from <= date_to)', 'The start date must be anterior to the end date.'),
    ]

    @api.constrains('date_from', 'date_to',
        'is_full_day', 'hour_from', 'hour_to',
        'company_ids', 'resource_calendar_ids')
    def _check_public_leave_overlap(self):
        overlapping_holidays = self.search([
            ('datetime_from', '<', max(self.mapped('datetime_to'))),
            ('datetime_to', '>', min(self.mapped('datetime_from'))),
            ('company_ids', 'in', self.company_ids.ids + [False]),
            ('resource_calendar_ids', 'in', self.resource_calendar_ids.ids + [False]),
        ])
        for public_leave in self:
            if overlapping_holidays.filtered(lambda hol:
                hol.id != public_leave.id
                and hol.datetime_from < public_leave.datetime_to
                and hol.datetime_to > public_leave.datetime_from
                and (hol.company_ids & public_leave.company_ids
                    or not hol.company_ids
                    or not public_leave.company_ids)
                and (hol.resource_calendar_ids & public_leave.resource_calendar_ids
                    or not hol.resource_calendar_ids
                    or not public_leave.resource_calendar_ids)
            ):
                raise ValidationError(_('Two public holidays cannot overlap each other for the same working hours.'))

    @api.constrains('date_from', 'date_to', 'is_full_day', 'hour_from', 'hour_to')
    def _check_from_to_order(self):
        for public_leave in self:
            if public_leave.date_from > public_leave.date_to\
                or (
                    public_leave.date_from == public_leave.date_to
                    and not public_leave.is_full_day
                    and float_to_time(float(public_leave.hour_from)) >= float_to_time(float(public_leave.hour_to))):
                raise ValidationError(_('The start of the public holiday must be anterior to the end.'))

    def _search_datetime(self, operator, value, field):
        if field not in ('datetime_from', 'datetime_to'):
            raise UserError(_('Invalid domain left operand %s', field))
        if operator not in ('<', '>', '=', '!=', '<=', '>='):
            raise UserError(_('Invalid domain operator %s', operator))
        if not isinstance(value, datetime):
            raise UserError(_("Invalid domain right operand '%s'. It must be a datetime object.", value))

        ids = []
        for public_leave in self.search([]):
            if OPERATORS[operator](
                    public_leave[field].astimezone(utc),
                    value.astimezone(utc)):
                ids.append(public_leave.id)

        return [('id', 'in', ids)]

    def _search_datetime_from(self, operator, value):
        return self._search_datetime(operator, value, 'datetime_from')

    def _search_datetime_to(self, operator, value):
        return self._search_datetime(operator, value, 'datetime_to')

    @api.depends('company_ids')
    def _compute_allowed_calendar_ids(self):
        all_calendars = self.env['resource.calendar'].search([])
        for public_leave in self:
            if not public_leave.company_ids:
                public_leave.allowed_calendar_ids = all_calendars
            else:
                public_leave.allowed_calendar_ids = all_calendars.filtered(
                    lambda cal: not cal.company_id or cal.company_id in public_leave.company_ids
                )

    @api.depends('company_ids')
    def _compute_calendar_ids(self):
        for public_leave in self:
            if not public_leave.company_ids:
                continue
            public_leave.resource_calendar_ids = public_leave.resource_calendar_ids.filtered(
                lambda cal: not cal.company_id or cal.company_id in public_leave.company_ids)

    @api.depends('date_from', 'is_full_day')
    def _compute_date_to(self):
        for public_leave in self:
            public_leave.date_to = public_leave.date_from

    @api.depends('date_from', 'date_to', 'is_full_day', 'hour_from', 'hour_to')
    def _compute_datetime(self):
        for public_leave in self:
            if public_leave.is_full_day:
                public_leave.datetime_from = datetime.combine(public_leave.date_from, time.min)
                public_leave.datetime_to = datetime.combine(public_leave.date_to, time.max)
                continue
            public_leave.datetime_to = datetime.combine(
                public_leave.date_to,
                float_to_time(float(public_leave.hour_from)))
            public_leave.datetime_from = datetime.combine(
                public_leave.date_from,
                float_to_time(float(public_leave.hour_to)))

    def _get_public_holidays_on_period(self, datetime_start, datetime_end=False, calendars=False, companies=False):
        companies = companies or calendars.company_id
        domain = [
            ('datetime_to', '>', datetime_start),
        ]
        if datetime_end:
            domain = expression.AND([domain, [
                ('datetime_from', '<', datetime_end),
            ]])
        # only take relevent calendars
        if calendars:
            domain = expression.AND([domain, [
                '|',
                ('calendar_ids', '=', False),
                ('calendar_ids', 'in', calendars.ids),
            ]])
        else:
            domain = expression.AND([domain, [
                ('calendar_ids', '=', False),
            ]])
        # only take relevent companies
        if companies:
            domain = expression.AND([domain, [
                '|',
                ('company_ids', '=', False),
                ('company_ids', 'in', companies.ids),
            ]])
        else:
            domain = expression.AND([domain, [
                ('company_ids', '=', False),
            ]])
        # only take relevent dates by also taking into account the day period
        return self.search(domain)
