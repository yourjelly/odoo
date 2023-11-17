# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.resource.models.utils import HOURS_SELECTION, date_time_to_utc

from odoo import api, fields, models

class UxFriendlyDatetimesMixin(models.AbstractModel):
    date_from = fields.Datetime(
        'Start Date', compute='_compute_date_from_to', store=True, required=False, index=True, tracking=True)
    date_to = fields.Datetime(
        'End Date', compute='_compute_date_from_to', store=True, required=False, tracking=True)
    request_date_from = fields.Date('Request Start Date')
    request_date_to = fields.Date('Request End Date')
    # Interface fields used when using hour-based computation
    request_hour_from = fields.Selection(HOURS_SELECTION, string='Hour from')
    request_hour_to = fields.Selection(HOURS_SELECTION, string='Hour to')
    # used only when the leave is taken in half days
    request_date_from_period = fields.Selection([
        ('am', 'Morning'), ('pm', 'Afternoon')],
        string="Date Period Start", default='am')
    # request type
    request_unit_half = fields.Boolean('Half Day', compute='_compute_request_unit_half', store=True, readonly=False)
    request_unit_hours = fields.Boolean('Custom Hours', compute='_compute_request_unit_hours', store=True, readonly=False)

    @api.depends('request_date_from_period', 'request_hour_from', 'request_hour_to',
        'request_date_from', 'request_date_to', 'request_unit_half', 'request_unit_hours')
    def _compute_date_from_to(self):
        for holiday in self:
            if not holiday.request_date_from:
                holiday.date_from = False
            elif not holiday.request_unit_half and not holiday.request_unit_hours and not holiday.request_date_to:
                holiday.date_to = False
            else:
                if (holiday.request_unit_half or holiday.request_unit_hours) and holiday.request_date_to != holiday.request_date_from:
                    holiday.request_date_to = holiday.request_date_from

                day_period = {
                    'am': 'morning',
                    'pm': 'afternoon'
                }.get(holiday.request_date_from_period, None) if holiday.request_unit_half else None

                attendance_from, attendance_to = holiday._get_attendances(holiday.request_date_from, holiday.request_date_to, day_period=day_period)

                compensated_request_date_from = holiday.request_date_from
                compensated_request_date_to = holiday.request_date_to

                if holiday.request_unit_hours:
                    hour_from = holiday.request_hour_from
                    hour_to = holiday.request_hour_to
                else:
                    hour_from = attendance_from.hour_from
                    hour_to = attendance_to.hour_to

                leave_tz = holiday.resource_calendar_id.tz or holiday.tz
                holiday.date_from = date_time_to_utc(compensated_request_date_from, hour_from, leave_tz)
                holiday.date_to = date_time_to_utc(compensated_request_date_to, hour_to, leave_tz)

    @api.depends('holiday_status_id', 'request_unit_hours')
    def _compute_request_unit_half(self):
        for holiday in self:
            if holiday.holiday_status_id or holiday.request_unit_hours:
                holiday.request_unit_half = False

    @api.depends('holiday_status_id', 'request_unit_half')
    def _compute_request_unit_hours(self):
        for holiday in self:
            if holiday.holiday_status_id or holiday.request_unit_half:
                holiday.request_unit_hours = False
