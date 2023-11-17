# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import models, fields, api, exceptions, _

class HrAttendanceReport(models.Model):
    _name = 'hr.attendance.report'
    _description = 'Attendance Report'

    date_from = fields.Date(string="From")
    date_to = fields.Date(string="To")

    line_ids = fields.One2many()


class HrAttendanceReportLine(models.Model):
    _name = 'hr.attendance.report.line'
    _description = 'Attendance Report Line'

    employee_id = fields.Many2one('hr.employee')
    worked_hours = fields.Float()
    presence_days = fields.Integer()
    absence_days = fields.Integer()
    number_of_attendances = fields.Integer()
