# -*- coding: utf-8 -*-
from datetime import date, datetime

from odoo.tests.common import TransactionCase


class TestHrTimesheetAttendanceReport(TransactionCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.partner = cls.env['res.partner'].create({
            'name': 'Customer Task',
            'email': 'customer@task.com',
            'phone': '42',
        })
        cls.analytic_account = cls.env['account.analytic.account'].create({
            'name': 'Analytic Account for Test Customer',
            'partner_id': cls.partner.id,
            'code': 'TEST'
        })
        # project
        cls.project_customer = cls.env['project.project'].create({
            'name': 'Project X',
            'allow_timesheets': True,
            'partner_id': cls.partner.id,
            'analytic_account_id': cls.analytic_account.id,
        })
        cls.test_user = cls.env['res.users'].create({
            'name': 'Test User',
            'login': 'test@test.com',
            'email': 'test@test.com',
            'groups_id': [(6, 0, [cls.env.ref('base.group_user').id, cls.env.ref('hr_timesheet.group_hr_timesheet_user').id])]
        })
        cls.test_employee = cls.env['hr.employee'].create({
            'name': "Captain",
            'user_id': cls.test_user.id,
        })
        cls.attendance = cls.env['hr.attendance'].create({
            'employee_id': cls.test_employee.id,
            'check_in': datetime(2022, 2, 9, 12, 0),
            'check_out': datetime(2022, 2, 9, 16, 0)
        })

    def test_timesheet_attendance_report(self):
        # this test checks the timesheet attendance report
        Timesheet = self.env['account.analytic.line']
        #create timesheet
        Timesheet.with_user(self.test_user).create({
            'name': 'Test timesheet 1',
            'project_id': self.project_customer.id,
            'unit_amount': 8,
            'date': date(2022, 2, 9),
            'employee_id': self.test_employee.id,
        })

        timesheet_attendance_stat = self.env['hr.timesheet.attendance.report'].read_group([('user_id', '=', self.test_user.id)], ['total_timesheet', 'total_attendance', 'total_difference'], ['user_id'])[0]
        self.assertTrue(timesheet_attendance_stat['total_difference'], timesheet_attendance_stat['total_attendance'] - timesheet_attendance_stat['total_timesheet'])
        self.assertEqual(timesheet_attendance_stat['total_difference'], -4.0, "Total difference in report should be difference of total attendance and total timesheet")
        self.assertEqual(timesheet_attendance_stat['total_timesheet'], 8.0, "Total timesheet in report should be 8.0")
        self.assertEqual(timesheet_attendance_stat['total_attendance'], 4.0, "Total attendance in report should be 4.0")
        # create second timesheet
        Timesheet.with_user(self.test_user).create({
            'name': 'Test timesheet 2',
            'project_id': self.project_customer.id,
            'unit_amount': 8,
            'date': date(2022, 2, 9),
            'employee_id': self.test_employee.id,
        })

        timesheet_attendance_2_stat = self.env['hr.timesheet.attendance.report'].read_group([('user_id', '=', self.test_user.id)], ['total_timesheet', 'total_attendance', 'total_difference'], ['user_id'])[0]
        self.assertTrue(timesheet_attendance_2_stat['total_difference'], timesheet_attendance_2_stat['total_attendance'] - timesheet_attendance_2_stat['total_timesheet'])
        self.assertEqual(timesheet_attendance_2_stat['total_difference'], -12.0, "Total difference in report should be difference of total attendance and total timesheet")
        self.assertEqual(timesheet_attendance_2_stat['total_timesheet'], 16.0, "Total timesheet in report should be 16.0")
        self.assertEqual(timesheet_attendance_2_stat['total_attendance'], 4.0, "Total attendance in report should be 4.0")
