# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests.common import TransactionCase


class TestTimesheetCommon(TransactionCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        # users
        cls.user_employee = cls.env['res.users'].create({
            'name': 'User Employee',
            'login': 'user_employee',
            'email': 'useremployee@test.com',
            'groups_id': [(6, 0, [cls.env.ref('hr_timesheet.group_hr_timesheet_user').id])],
        })

        cls.user_employee2 = cls.env['res.users'].create({
            'name': 'User Employee 2',
            'login': 'user_employee2',
            'email': 'useremployee2@test.com',
            'groups_id': [(6, 0, [cls.env.ref('hr_timesheet.group_hr_timesheet_user').id])],
        })

        # employees
        cls.empl_employee = cls.env['hr.employee'].create({
            'name': 'User Empl Employee',
            'user_id': cls.user_employee.id,
        })

        cls.empl_employee2 = cls.env['hr.employee'].create({
            'name': 'User Empl Employee 2',
            'user_id': cls.user_employee2.id,
        })

        cls.project_manager = cls.env['res.users'].create({
            'name': 'user_project_manager',
            'login': 'user_project_manager',
            'groups_id': [(6, 0, [cls.env.ref('project.group_project_manager').id])],
        })

        cls.project = cls.env['project.project'].create({
            'name': 'Project With Timesheets',
            'privacy_visibility': 'employees',
            'allow_timesheets': True,
            'user_id': cls.project_manager.id,
        })

        cls.second_project = cls.env['project.project'].create({
            'name': 'Project w/ timesheets',
            'privacy_visibility': 'employees',
            'allow_timesheets': True,
            'user_id': cls.project_manager.id,
        })

        cls.task_1 = cls.env['project.task'].create({
            'name': 'First task',
            'user_ids': cls.user_employee2,
            'project_id': cls.project.id
        })

        cls.timesheet = cls.env['account.analytic.line'].create({
            'name': 'FirstTimeSheet',
            'project_id': cls.project.id,
            'task_id': cls.task_1.id,
            'unit_amount': 2,
            'employee_id': cls.empl_employee2.id
        })

        cls.task_2 = cls.env['project.task'].create({
            'name': 'second task',
            'user_ids': cls.user_employee2,
            'project_id': cls.second_project.id
        })

        cls.timesheet2 = cls.env['account.analytic.line'].create({
            'name': 'secondTimeSheet',
            'project_id': cls.second_project.id,
            'task_id': cls.task_2.id,
            'unit_amount': 1,
            'employee_id': cls.empl_employee.id
        })

        cls.task_3 = cls.env['project.task'].create({
            'name': 'third task',
            'user_ids': cls.user_employee2,
            'project_id': cls.second_project.id
        })

        cls.timesheet3 = cls.env['account.analytic.line'].create({
            'name': 'secondTimeSheet',
            'project_id': cls.second_project.id,
            'task_id': cls.task_3.id,
            'unit_amount': 1,
            'employee_id': cls.empl_employee.id
        })
