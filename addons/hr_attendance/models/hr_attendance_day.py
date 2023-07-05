# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import datetime, timedelta
import calendar
from odoo import models, fields, api, exceptions, _
from collections import defaultdict


class HrAttendanceDay(models.Model):
    _name = "hr.attendance.day"
    _description = "Attendance Day"
    _order = "attendance_day desc"

    def _get_selection(self):
        current_year = datetime.now().year
        return [(str(i), i) for i in range(2010, current_year + 1)]

    attendance_day = fields.Date(string="Day", required=True)
    employee_id = fields.Many2one('hr.employee', string="Employee", default=lambda self: self.env.user.employee_id,
                                  required=True, ondelete='cascade', index=True)
    attendance_ids = fields.One2many('hr.attendance', 'attendance_day_id')
    first_check_in = fields.Datetime(string="First Check-In", compute="_compute_work_break_time")
    last_check_out = fields.Datetime(string="Last Check-out", compute="_compute_work_break_time")
    duration = fields.Float(string="Duration", compute='_compute_work_break_time')
    work_time = fields.Float(string="Work Time", compute='_compute_work_break_time')
    break_time = fields.Float(string='Break Time', compute='_compute_work_break_time')
    out_time = fields.Float(string="Out Time", compute='_compute_work_break_time')

    @api.depends('attendance_ids')
    def _compute_work_break_time(self):
        for record in self:
            if record.attendance_ids:
                record.first_check_in = record.attendance_ids[0].check_in
                record.last_check_out = record.attendance_ids[-1].check_out
                record.work_time = sum([(att.check_out - att.check_in).seconds for att in record.attendance_ids if att.check_out and att.type == "work"]) / 3600
                record.break_time = sum([(att.check_out - att.check_in).seconds for att in record.attendance_ids if att.check_out and att.type == "break"]) / 3600
                record.out_time = sum([(att.check_out - att.check_in).seconds for att in record.attendance_ids if att.check_out and att.type == "out"]) / 3600
                record.duration = record.work_time + record.break_time + record.out_time
            else:
                record.first_check_in = False
                record.last_check_out = False
                record.duration = False
                record.work_time = False
                record.break_time = False
