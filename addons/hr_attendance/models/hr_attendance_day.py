# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import pytz

from collections import defaultdict
from datetime import datetime, timedelta
import calendar
from operator import itemgetter
from pytz import timezone

from odoo import models, fields, api, exceptions, _
from odoo.addons.resource.models.utils import Intervals
from odoo.tools import format_datetime
from odoo.osv.expression import AND, OR
from odoo.tools.float_utils import float_is_zero
from odoo.exceptions import AccessError
from collections import defaultdict


class HrAttendanceSheet(models.Model):
    _name = "hr.attendance.sheet"
    _description = "Attendance Sheet"

    def _get_selection(self):
        current_year = datetime.now().year
        return [(str(i), i) for i in range(2010, current_year + 1)]

    year = fields.Selection(
        selection='_get_selection', string='Year', required=True,
        default=lambda x: str(datetime.now().year))

    month = fields.Selection([
        ('1', 'January'),
        ('2', 'February'),
        ('3', 'March'),
        ('4', 'April'),
        ('5', 'May'),
        ('6', 'June'),
        ('7', 'July'),
        ('8', 'August'),
        ('9', 'September'),
        ('10', 'October'),
        ('11', 'November'),
        ('12', 'December'),
    ], string='Month',
        default='1')

    employee_id = fields.Many2one('hr.employee', string="Employee", default=lambda self: self.env.user.employee_id,
                                  required=True, ondelete='cascade', index=True)
    attendance_day_ids = fields.One2many('hr.attendance.day', 'attendance_sheet_id')


    def action_generate_attendance_days(self):
        for sheet in self:
            last_day = calendar.monthrange(int(sheet.year), int(sheet.month))[1]
            attendances = self.env['hr.attendance'].search([
                ('employee_id', '=', sheet.employee_id.id),
                ('check_in', '>=', datetime(int(sheet.year), int(sheet.month), 1).date()),
                ('check_in', '<=', datetime(int(sheet.year), int(sheet.month), last_day).date())
            ], order="check_in asc")
            attendances_by_day = defaultdict(list)

            for attendance in attendances:
                check_in_date = attendance.check_in.date()
                attendances_by_day[check_in_date].append(attendance)

            for day in attendances_by_day:
                first_check_in = attendances_by_day[day][0].check_in
                last_check_out = attendances_by_day[day][-1].check_out
                total_shift = (last_check_out - first_check_in)
                counted_check_out_time = 0
                if len(attendances_by_day[day]) > 1:
                    for i in range(len(attendances_by_day[day])-1):
                        break_time = (attendances_by_day[day][i+1].check_in - attendances_by_day[day][i].check_out).seconds
                        if break_time > self.env.company.attendance_minimal_pause_time*60:
                            counted_check_out_time += (attendances_by_day[day][i+1].check_in - attendances_by_day[day][i].check_out).seconds

                checked_in_time = total_shift.seconds - counted_check_out_time

                company_break_times = self.env['hr.attendance.break'].search([('company_id', '=', self.env.company.id),
                                                                              ('working_time', '<=',
                                                                               checked_in_time / 3600)]).mapped('corresponding_mandatory_pause_time')
                remaining_break_time = 0
                if company_break_times:
                    remaining_break_time = max(company_break_times[-1] * 60 - counted_check_out_time, 0)
                paid_worked_hours = checked_in_time
                if remaining_break_time > 0:
                    paid_worked_hours = checked_in_time - remaining_break_time

                unpaid_pause_time = total_shift.seconds - paid_worked_hours

                sheet.attendance_day_ids.create([{
                    "attendance_sheet_id": sheet.id,
                    "attendance_day": day,
                    "shift_start": attendances_by_day[day][0].check_in,
                    "shift_end": attendances_by_day[day][-1].check_out,
                    "total_shift": total_shift.seconds / 3600,
                    "checked_in_time": checked_in_time / 3600,
                    "pause_time": counted_check_out_time / 3600,
                    "paid_worked_time": paid_worked_hours / 3600,
                    "unpaid_pause_time": unpaid_pause_time/3600
                }])



class HrAttendanceDay(models.Model):
    _name = "hr.attendance.day"
    _description = "Attendance Day"

    attendance_sheet_id = fields.Many2one('hr.attendance.sheet')
    attendance_day = fields.Date(string="Day", required=True)
    shift_start = fields.Datetime(string="Shift start")
    shift_end = fields.Datetime(string="Shift end")
    total_shift = fields.Float(string="Total Shift Duration")
    checked_in_time = fields.Float(string="Checked in time")
    pause_time = fields.Float(string="Voluntary Pause Time")
    paid_worked_time = fields.Float(string="Paid Worked time")
    unpaid_pause_time = fields.Float(string="Unpaid Pause Time")
