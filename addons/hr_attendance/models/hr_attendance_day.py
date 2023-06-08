# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import datetime, timedelta
import calendar
from odoo import models, fields, api, exceptions, _
from collections import defaultdict


class HrAttendanceDay(models.Model):
    _name = "hr.attendance.day"
    _description = "Attendance Day"

    def _get_selection(self):
        current_year = datetime.now().year
        return [(str(i), i) for i in range(2010, current_year + 1)]

    attendance_day = fields.Date(string="Day", required=True)
    employee_id = fields.Many2one('hr.employee', string="Employee", default=lambda self: self.env.user.employee_id,
                                  required=True, ondelete='cascade', index=True)
    attendance_ids = fields.One2many('hr.attendance', 'attendance_day_id', compute='_compute_attendance_days')
    first_check_in = fields.Datetime(string="First Check-In", compute="_compute_day_results")
    last_check_out = fields.Datetime(string="Last Check-out")
    duration = fields.Float(string="Duration", compute='_compute_duration')
    work_time = fields.Float(string="Work Time", compute='_compute_work_break_time')
    break_time = fields.Float(string='Break Time', compute='_compute_work_break_time')

    @api.depends('first_check_in', 'last_check_out')
    def _compute_duration(self):
        for record in self:
            record.duration = (record.last_check_out - record.first_check_int).seconds

    @api.depends('attendance_ids')
    def _compute_work_break_time(self):
        for record in self:
            attendance_number = len(record.attendance_ids)
            break_time = 0
            if attendance_number > 1:
                for i in range(attendance_number-1):
                    break_time += (record.attendance_ids[i + 1].check_in - record.attendance_ids[i].check_out).seconds

            record.work_time = record.duration - break_time
            record.break_time = break_time

    @api.depends('employee_id.attendance_state', 'attendance_day')
    def _compute_attendance_days(self):
        for record in self:
            attendances = self.env['hr.attendance'].search([('check_in', '>=', record.attendance_day),
                                                                      ('check_out', '<=', record.attendance_day),
                                                                      ('employee_id', '=', record.employee_id.id)])

            if attendances:
                record.attendance_ids = attendances.ids
            else:
                record.attendance_ids = False

    def action_generate_attendance_days(self):
        return
        """
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
        """