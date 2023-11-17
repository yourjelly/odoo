# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import date, datetime, timedelta
from odoo.addons.hr_holidays.tests.common import TestHrHolidaysCommon
from odoo.exceptions import ValidationError
from freezegun import freeze_time

from odoo.tests import tagged

@tagged('global_leaves')
class TestGlobalLeaves(TestHrHolidaysCommon):
    """ Test global leaves for a whole company, conflict resolutions """

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.calendar_1 = cls.env['resource.calendar'].create({
            'name': 'Classic 40h/week',
            'tz': 'UTC',
            'hours_per_day': 8.0,
            'attendance_ids': [
                (0, 0, {'name': 'Monday Morning', 'dayofweek': '0', 'hour_from': 8, 'hour_to': 12, 'day_period': 'morning'}),
                (0, 0, {'name': 'Monday Lunch', 'dayofweek': '0', 'hour_from': 12, 'hour_to': 13, 'day_period': 'lunch'}),
                (0, 0, {'name': 'Monday Afternoon', 'dayofweek': '0', 'hour_from': 13, 'hour_to': 17, 'day_period': 'afternoon'}),
                (0, 0, {'name': 'Tuesday Morning', 'dayofweek': '1', 'hour_from': 8, 'hour_to': 12, 'day_period': 'morning'}),
                (0, 0, {'name': 'Tuesday Lunch', 'dayofweek': '1', 'hour_from': 12, 'hour_to': 13, 'day_period': 'lunch'}),
                (0, 0, {'name': 'Tuesday Afternoon', 'dayofweek': '1', 'hour_from': 13, 'hour_to': 17, 'day_period': 'afternoon'}),
                (0, 0, {'name': 'Wednesday Morning', 'dayofweek': '2', 'hour_from': 8, 'hour_to': 12, 'day_period': 'morning'}),
                (0, 0, {'name': 'Wednesday Lunch', 'dayofweek': '2', 'hour_from': 12, 'hour_to': 13, 'day_period': 'lunch'}),
                (0, 0, {'name': 'Wednesday Afternoon', 'dayofweek': '2', 'hour_from': 13, 'hour_to': 17, 'day_period': 'afternoon'}),
                (0, 0, {'name': 'Thursday Morning', 'dayofweek': '3', 'hour_from': 8, 'hour_to': 12, 'day_period': 'morning'}),
                (0, 0, {'name': 'Thursday Lunch', 'dayofweek': '3', 'hour_from': 12, 'hour_to': 13, 'day_period': 'lunch'}),
                (0, 0, {'name': 'Thursday Afternoon', 'dayofweek': '3', 'hour_from': 13, 'hour_to': 17, 'day_period': 'afternoon'}),
                (0, 0, {'name': 'Friday Morning', 'dayofweek': '4', 'hour_from': 8, 'hour_to': 12, 'day_period': 'morning'}),
                (0, 0, {'name': 'Friday Lunch', 'dayofweek': '4', 'hour_from': 12, 'hour_to': 13, 'day_period': 'lunch'}),
                (0, 0, {'name': 'Friday Afternoon', 'dayofweek': '4', 'hour_from': 13, 'hour_to': 17, 'day_period': 'afternoon'})
            ]
        })

        cls.calendar_2 = cls.env['resource.calendar'].create({
            'name': 'Classic 20h/week',
            'tz': 'UTC',
            'hours_per_day': 4.0,
            'attendance_ids': [
                (0, 0, {'name': 'Monday Morning', 'dayofweek': '0', 'hour_from': 8, 'hour_to': 12, 'day_period': 'morning'}),
                (0, 0, {'name': 'Tuesday Morning', 'dayofweek': '1', 'hour_from': 8, 'hour_to': 12, 'day_period': 'morning'}),
                (0, 0, {'name': 'Wednesday Morning', 'dayofweek': '2', 'hour_from': 8, 'hour_to': 12, 'day_period': 'morning'}),
                (0, 0, {'name': 'Thursday Morning', 'dayofweek': '3', 'hour_from': 8, 'hour_to': 12, 'day_period': 'morning'}),
                (0, 0, {'name': 'Friday Morning', 'dayofweek': '4', 'hour_from': 8, 'hour_to': 12, 'day_period': 'morning'}),
            ]
        })

        cls.global_leave = cls.env['resource.public.leave'].create({
            'name': 'Global Time Off',
            'date_from': date(2022, 3, 7),
            'date_to': date(2022, 3, 7),
        })

        cls.calendar_leave = cls.env['resource.public.leave'].create({
            'name': 'Global Time Off',
            'date_from': date(2022, 3, 8),
            'date_to': date(2022, 3, 8),
            'calendar_ids': cls.calendar_1.ids,
        })

    def test_leave_on_global_leave(self):
        with self.assertRaises(ValidationError):
            self.env['resource.public.leave'].create({
                'name': 'Wrong Time Off',
                'date_from': date(2022, 3, 7),
                'date_to': date(2022, 3, 7),
                'calendar_ids': self.calendar_1.ids,
            })

        with self.assertRaises(ValidationError):
            self.env['resource.public.leave'].create({
                'name': 'Wrong Time Off',
                'date_from': date(2022, 3, 7),
                'date_to': date(2022, 3, 7),
            })

    def test_leave_on_calendar_leave(self):
        self.env['resource.public.leave'].create({
            'name': 'Correct Time Off',
            'date_from': date(2022, 3, 8),
            'date_to': date(2022, 3, 8),
            'calendar_ids': self.calendar_2.ids,
        })

        with self.assertRaises(ValidationError):
            self.env['resource.public.leave'].create({
                'name': 'Wrong Time Off',
                'date_from': date(2022, 3, 8),
                'date_to': date(2022, 3, 8),
            })

        # the leave should be able to be created as it's concerning a different calendar
        self.env['resource.public.holiday'].create({
            'name': 'Wrong Time Off',
            'date_from': date(2022, 3, 8),
            'date_to': date(2022, 3, 8),
            'calendar_ids': self.calendar_1.ids,
        })

    @freeze_time('2023-05-12')
    def test_global_leave_timezone(self):
        """
            It is necessary to use the timezone of the calendar
            for the global leaves (without resource).
        """
        calendar_asia = self.env['resource.calendar'].create({
            'name': 'Asia calendar',
            'tz': 'Asia/Calcutta',  # UTC +05:30
            'hours_per_day': 8.0,
            'attendance_ids': []
        })
        self.env.user.tz = 'Europe/Brussels'
        global_leave = self.env['resource.public.leave'].with_user(self.env.user).create({
            'name': 'Public holiday',
            'date_from': '2023-05-15',
            'date_to': '2023-05-15',
            'is_full_day': False,
            'hour_from': '8',
            'hour_to': '17',
            'calendar_ids': calendar_asia.ids,
        })
        # datetime unchanged whichever timezone we're in
        self.assertEqual(global_leave.datetime_from, datetime(2023, 5, 15, 8))
        self.assertEqual(global_leave.datetime_to, datetime(2023, 5, 15, 17))

    def test_global_leave_number_of_days_with_new(self):
        """
            Check that leaves stored in memory (and not in the database)
            take into account global leaves.
        """
        global_leave = self.env['resource.calendar.leaves'].create({
            'name': 'Global Time Off',
            'date_from': datetime(2024, 1, 3, 6, 0, 0),
            'date_to': datetime(2024, 1, 3, 19, 0, 0),
            'calendar_id': self.calendar_1.id,
        })
        leave_type = self.env['hr.leave.type'].create({
            'name': 'Paid Time Off',
            'time_type': 'leave',
            'requires_allocation': 'no',
        })
        self.employee_emp.resource_calendar_id = self.calendar_1.id

        leave = self.env['hr.leave'].create({
            'name': 'Test new leave',
            'employee_id': self.employee_emp.id,
            'holiday_status_id': leave_type.id,
            'request_date_from': global_leave.date_from,
            'request_date_to': global_leave.date_to,
        })
        self.assertEqual(leave.number_of_days, 0, 'It is a global leave')

        leave = self.env['hr.leave'].new({
            'name': 'Test new leave',
            'employee_id': self.employee_emp.id,
            'holiday_status_id': leave_type.id,
            'request_date_from': global_leave.date_from,
            'request_date_to': global_leave.date_to,
        })
        self.assertEqual(leave.number_of_days, 0, 'It is a global leave')

        leave = self.env['hr.leave'].new({
            'name': 'Test new leave',
            'employee_id': self.employee_emp.id,
            'holiday_status_id': leave_type.id,
            'request_date_from': global_leave.date_from - timedelta(days=1),
            'request_date_to': global_leave.date_to + timedelta(days=1),
        })
        self.assertEqual(leave.number_of_days, 2, 'There is a global leave')
