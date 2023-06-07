# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import models, fields


class HrAttendanceBreak(models.Model):
    _name = "hr.attendance.break"
    _description = "Attendance Break"
    _order = "working_time asc"

    working_time = fields.Integer(string="Worked hours")
    corresponding_mandatory_pause_time = fields.Integer(string="Break Time (Minutes)")
    company_id = fields.Many2one('res.company', default=lambda self: self.env.company)
