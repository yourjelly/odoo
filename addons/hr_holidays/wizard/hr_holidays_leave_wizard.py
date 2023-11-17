# Part of Odoo. See LICENSE file for full copyright and licensing details.

from collections import defaultdict

from odoo import api, fields, models
from odoo.addons.resource.models.utils import HOURS_SELECTION, date_time_to_utc

class HrHolidaysLeaveWizard(models.TransientModel):
    _name = 'hr.holidays.leave.wizard'
    _description = 'HR Time Off Creator for Managers'
    _inherit = ['resource.leave.wizard.mixin']

    employee_ids = fields.Many2many(comodel_name='hr.employee', string='Employees',
        domain=lambda self: self._get_employee_domain())
    department_id = fields.Many2one(comodel_name='hr.department',
        compute="_compute_department_id", export_string_translation=False)
    leave_type_id = fields.Many2one(
        comodel_name="hr.leave.type", compute='_compute_from_employee_id',
        string="Time Off Type", required=True, readonly=False,
        domain="""[('company_id', 'in', [employee_ids.company_id, False])]""")
    leave_type_request_unit = fields.Selection(related='leave_type_id.request_unit', readonly=True)

    # description
    notes = fields.Text('Reasons', readonly=False)

    tz_mismatch = fields.Boolean(compute='_compute_tz_mismatch')
    # duration
    resource_calendar_id = fields.Many2one('resource.calendar', compute='_compute_resource_calendar_id',
        readonly=False)
    # These dates are computed based on request_date_{to,from} and should
    # therefore never be set directly.
    date_from = fields.Datetime(
        'Start Date', compute='_compute_date_from_to')
    date_to = fields.Datetime(
        'End Date', compute='_compute_date_from_to')
    number_of_days = fields.Float(
        'Duration (Days)', compute='_compute_duration',
        help='Number of days of the time off request. Used in the calculation.')
    number_of_hours = fields.Float(
        'Duration (Hours)', compute='_compute_duration',
        help='Number of hours of the time off request. Used in the calculation.')
    last_several_days = fields.Boolean("All day", compute="_compute_last_several_days")

    request_date_from = fields.Date('Dates')
    request_date_to = fields.Date(export_string_translation=False)
    # request type
    request_unit_half = fields.Boolean('Half Day', compute='_compute_request_unit_half', store=True, readonly=False)
    request_unit_hours = fields.Boolean('Custom Hours', compute='_compute_request_unit_hours', store=True, readonly=False)
    # Interface fields used when using hour-based computation
    request_hour_from = fields.Selection(selection=HOURS_SELECTION, string='From')
    request_hour_to = fields.Selection(selection=HOURS_SELECTION, string='To')
    # used only when the leave is taken in half days
    request_date_from_period = fields.Selection(selection=[
        ('am', 'Morning'), ('pm', 'Afternoon')],
        export_string_translation=False, default='am')

    @api.depends('employee_ids')
    def _compute_department_id(self):
        for wizard in self:
            if len(wizard.employee_ids) > 1:
                wizard.department_id = False
                continue
            wizard.department_id = wizard.employee_ids.department_id

    @api.depends('date_from', 'date_to', 'resource_calendar_id', 'leave_type_id.request_unit')
    def _compute_duration(self):
        for wizard in self:
            if len(wizard.employee_ids) == 1:
                employee_leave = self.env['hr.leave'].new({
                    'employee_id': self.employee_ids.id,
                    'leave_type_id': self.leave_type_id.id,
                    'date_from': self.date_from,
                    'date_to': self.date_to,
                })
                days, hours = employee_leave.get_duration()
                wizard.number_of_hours = hours
                wizard.number_of_days = days
                continue
            resource_calendar = wizard.employee_ids.company_id.resource_calendar_id
            if len(resource_calendar) > 1:
                wizard.number_of_hours = 0
                wizard.number_of_days = 0
                continue
            intervals = resource_calendar._work_intervals_batch(wizard.date_from, wizard.date_to)[False]  # TODO BEDO
            result = defaultdict({
                'hours': 0,
                'days': 0,
            })
            for start, stop, meta in intervals:
                result[start.date()]['hours'] += (stop - start).total_seconds() / 3600
                result[start.date()]['days'] += meta.duration_days
            hours = 0
            days = 0
            for date in result:
                hours += date['hours']
                if self.leave_type_request_unit == 'day':
                    days += 1
                else:
                    days += date['days']
            wizard.number_of_hours = hours
            wizard.number_of_days = days

    @api.depends('request_date_from_period', 'request_hour_from', 'request_hour_to',
        'request_date_from', 'request_date_to', 'request_unit_half', 'request_unit_hours')
    def _compute_date_from_to(self):
        for wizard in self:
            request_date_from = wizard.request_date_from
            request_date_to = wizard.request_date_to
            if not request_date_from:
                wizard.date_from = False
                continue
            if not wizard.request_unit_half and not wizard.request_unit_hours and not request_date_to:
                wizard.date_to = False
                continue
            if (wizard.request_unit_half or wizard.request_unit_hours) and request_date_to != request_date_from:
                wizard.request_date_to = request_date_from
                request_date_to = request_date_from

            day_period = {
                'am': 'morning',
                'pm': 'afternoon'
            }.get(wizard.request_date_from_period, None) if wizard.request_unit_half else None

            attendance_from, attendance_to = wizard._get_attendances(
                request_date_from,
                request_date_to,
                day_period=day_period)
            hour_from = wizard.request_hour_from if wizard.request_unit_hours else attendance_from.hour_from
            hour_to = wizard.request_hour_to if wizard.request_unit_hours else attendance_to.hour_to

            wizard_tz = wizard.resources_ids.tz if len(wizard.resources_ids.tz) == 1 else self.env.user.tz
            wizard.date_from = date_time_to_utc(request_date_from, hour_from, wizard_tz)
            wizard.date_to = date_time_to_utc(request_date_to, hour_to, wizard_tz)

    @api.depends('leave_type_id', 'request_unit_hours')
    def _compute_request_unit_half(self):
        for wizard in self:
            if wizard.leave_type_id or wizard.request_unit_hours:
                wizard.request_unit_half = False

    @api.depends('leave_type_id', 'request_unit_half')
    def _compute_request_unit_hours(self):
        for wizard in self:
            if wizard.leave_type_id or wizard.request_unit_half:
                wizard.request_unit_hours = False

    def _get_employee_domain(self):
        domain = [
            ('active', '=', True),
            ('company_id', 'in', self.env.companies.ids),
        ]
        if not self.env.user.has_group('hr_holidays.group_hr_holidays_user'):
            domain += [
                '|',
                ('user_id', '=', self.env.uid),
                ('leave_manager_id', '=', self.env.uid),
            ]
        return domain

    def _create_leaves(self):
        vals_list = []
        for wizard in self:
            vals_list += [{
                'employee_id': employee.id,
                'holiday_status_id': wizard.leave_type_id,
                'notes': wizard.notes,
                'request_date_from': wizard.request_date_from,
                'request_date_to': wizard.request_date_to,
                'request_unit_half': wizard.request_unit_half,
                'request_unit_hours': wizard.request_unit_hours,
                'request_hour_from': wizard.request_hour_from,
                'request_hour_to': wizard.request_hour_to,
                'request_date_from_period': wizard.request_date_from_period,
            } for employee in wizard.employee_ids]
        self.env['hr.leave'].create(vals_list)
