# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from datetime import datetime
from dateutil.relativedelta import relativedelta

from odoo import Command
from odoo.fields import Datetime,Date
from odoo.tests.common import TransactionCase


class TestHolidayContract(TransactionCase):

    @classmethod
    def setUpClass(cls):
        super(TestHolidayContract, cls).setUpClass()

        cls.leave_type = cls.env['hr.leave.type'].create({
            'name': 'Legal Leaves',
            'time_type': 'leave',
            'requires_allocation': 'no',
            'responsible_ids': [Command.link(cls.env.ref('base.user_admin').id)],
        })
        cls.env.ref('base.user_admin').notification_type = 'inbox'

        # I create a new employee "Jules"
        cls.jules_emp = cls.env['hr.employee'].create({
            'name': 'Jules',
            'gender': 'male',
            'birthday': '1984-05-01',
            'country_id': cls.env.ref('base.be').id,
            # 'department_id': cls.dep_rd.id,
        })

        cls.calendar_35h = cls.env['resource.calendar'].create({
            'name': '35h calendar',
            'attendance_ids': [
                (0, 0, {'name': 'Monday Morning', 'dayofweek': '0', 'hour_from': 8, 'hour_to': 12, 'day_period': 'morning'}),
                (0, 0, {'name': 'Monday Lunch', 'dayofweek': '0', 'hour_from': 12, 'hour_to': 13, 'day_period': 'lunch'}),
                (0, 0, {'name': 'Monday Evening', 'dayofweek': '0', 'hour_from': 13, 'hour_to': 16, 'day_period': 'afternoon'}),
                (0, 0, {'name': 'Tuesday Morning', 'dayofweek': '1', 'hour_from': 8, 'hour_to': 12, 'day_period': 'morning'}),
                (0, 0, {'name': 'Tuesday Lunch', 'dayofweek': '1', 'hour_from': 12, 'hour_to': 13, 'day_period': 'lunch'}),
                (0, 0, {'name': 'Tuesday Evening', 'dayofweek': '1', 'hour_from': 13, 'hour_to': 16, 'day_period': 'afternoon'}),
                (0, 0, {'name': 'Wednesday Morning', 'dayofweek': '2', 'hour_from': 8, 'hour_to': 12, 'day_period': 'morning'}),
                (0, 0, {'name': 'Wednesday Lunch', 'dayofweek': '2', 'hour_from': 12, 'hour_to': 13, 'day_period': 'lunch'}),
                (0, 0, {'name': 'Wednesday Evening', 'dayofweek': '2', 'hour_from': 13, 'hour_to': 16, 'day_period': 'afternoon'}),
                (0, 0, {'name': 'Thursday Morning', 'dayofweek': '3', 'hour_from': 8, 'hour_to': 12, 'day_period': 'morning'}),
                (0, 0, {'name': 'Thursday Lunch', 'dayofweek': '3', 'hour_from': 12, 'hour_to': 13, 'day_period': 'lunch'}),
                (0, 0, {'name': 'Thursday Evening', 'dayofweek': '3', 'hour_from': 13, 'hour_to': 16, 'day_period': 'afternoon'}),
                (0, 0, {'name': 'Friday Morning', 'dayofweek': '4', 'hour_from': 8, 'hour_to': 12, 'day_period': 'morning'}),
                (0, 0, {'name': 'Friday Lunch', 'dayofweek': '4', 'hour_from': 12, 'hour_to': 13, 'day_period': 'lunch'}),
                (0, 0, {'name': 'Friday Evening', 'dayofweek': '4', 'hour_from': 13, 'hour_to': 16, 'day_period': 'afternoon'})
            ]
        })
        cls.calendar_40h = cls.env['resource.calendar'].create({'name': 'Default calendar'})

        # This contract ends at the 15th of the month
        cls.contract_cdd = cls.env['hr.contract'].create({  # Fixed term contract
            'date_end': datetime.strptime('2015-11-15', '%Y-%m-%d'),
            'date_start': datetime.strptime('2015-01-01', '%Y-%m-%d'),
            'name': 'First CDD Contract for Jules',
            'resource_calendar_id': cls.calendar_40h.id,
            'wage': 5000.0,
            'employee_id': cls.jules_emp.id,
            'state': 'open',
            'kanban_state': 'blocked',
        })

        # This contract starts the next day
        cls.contract_cdi = cls.env['hr.contract'].create({
            'date_start': datetime.strptime('2015-11-16', '%Y-%m-%d'),
            'name': 'Contract for Jules',
            'resource_calendar_id': cls.calendar_35h.id,
            'wage': 5000.0,
            'employee_id': cls.jules_emp.id,
            'state': 'open',
            'kanban_state': 'normal',
        })

    # I create a new employee "Richard"
        cls.richard_emp = cls.env['hr.employee'].create({
            'name': 'Richard',
            'gender': 'male',
            'birthday': '1984-05-01',
            'country_id': cls.env.ref('base.be').id,
            # 'department_id': cls.dep_rd.id,
        })

        # I create a contract for "Richard"
        cls.env['hr.contract'].create({
            'date_end': Date.today() + relativedelta(years=2),
            'date_start': Date.to_date('2018-01-01'),
            'name': 'Contract for Richard',
            'wage': 5000.0,
            'employee_id': cls.richard_emp.id,
        })

    @classmethod
    def create_leave(cls, date_from=None, date_to=None):
        date_from = date_from or Datetime.today()
        date_to = date_to or Datetime.today() + relativedelta(days=1)
        return cls.env['hr.leave'].create({
            'name': 'Holiday!!!',
            'employee_id': cls.richard_emp.id,
            'holiday_status_id': cls.leave_type.id,
            'date_to': date_to,
            'date_from': date_from,
            'number_of_days': 1,
        })
