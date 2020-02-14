# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class Employee(models.AbstractModel):
    _inherit = 'hr.employee.base'

    def _compute_presence_state(self):
        """
        Override to include checkin/checkout in the presence state
        Attendance has the second highest priority after login
        """
        super()._compute_presence_state()
        employees = self.filtered(lambda employee: employee.hr_presence_state != 'present')
        for employee in employees:
            if employee.attendance_state == 'checked_in':
                employee.hr_presence_state = 'present'
