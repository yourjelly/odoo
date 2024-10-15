# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields
from odoo.addons import hr


class ResUsers(hr.ResUsers):

    employee_cars_count = fields.Integer(related='employee_id.employee_cars_count')

    @property
    def SELF_READABLE_FIELDS(self):
        return super().SELF_READABLE_FIELDS + ['employee_cars_count']

    def action_open_employee_cars(self):
        return self.employee_id.action_open_employee_cars()
