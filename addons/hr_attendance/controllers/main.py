# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import http, fields
from odoo.http import request


class HrAttendance(http.Controller):
    @http.route('/hr_attendance/kiosk_keepalive', auth='user', type='json')
    def kiosk_keepalive(self):
        request.session.touch()
        return {}

    @http.route('/hr_attendance/monitor_screen', auth='user', type='json')
    def get_employee_attendance_data(self):
        employees = request.env['hr.employee'].search([])
        today_date = fields.Date.today()
        a = request.env['hr.employee.public']
        categories = ['checked_in', 'in_break', '']
        attendance_data = {
            'data': {"checked_in": len([e for e in employees if e.last_attendance_day_id and e.last_attendance_day_id.attendance_day == today_date and not e.last_attendance_id.check_out])},
            'categories': categories
            }
        return attendance_data
