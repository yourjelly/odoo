# -*- coding: utf-8 -*-
from collections import defaultdict

from .common import TestTimesheetCommon

# import pdb; pdb.set_trace()
class TestHrTimesheetReport(TestTimesheetCommon):

    def test_timesheet_by_employee_report(self):

        group_data = self.env['account.analytic.line'].sudo().read_group(['|', ('employee_id', '=', self.empl_employee.id), ('employee_id', '=', self.empl_employee2.id)], ['employee_id', 'unit_amount'], ['employee_id'])
        timesheet_unit_amount_dict = defaultdict(float)
        timesheet_unit_amount_dict.update({data['employee_id'][0]: data['unit_amount'] for data in group_data})

        self.assertEqual(len(timesheet_unit_amount_dict), 2, "there should be two record in report")
        self.assertEqual(timesheet_unit_amount_dict.get(self.empl_employee.id), 1.0, "unit amount for employee1 should be 1")
        self.assertEqual(timesheet_unit_amount_dict.get(self.empl_employee2.id), 2.0, "unit amount for employee2 should be 2.0")

    def test_timesheet_by_project_report(self):

        group_data = self.env['account.analytic.line'].sudo().read_group(['|', ('project_id', '=', self.project.id), ('project_id', '=', self.second_project.id)], ['project_id', 'unit_amount'], ['project_id'])
        timesheet_unit_amount_dict = defaultdict(float)
        timesheet_unit_amount_dict.update({data['project_id'][0]: data['unit_amount'] for data in group_data})

        self.assertEqual(len(timesheet_unit_amount_dict), 2, "there should be two record in report")
        self.assertEqual(timesheet_unit_amount_dict.get(self.project.id), 2.0, "unit amount for project should be 1")
        self.assertEqual(timesheet_unit_amount_dict.get(self.second_project.id), 1.0, "unit amount for second_project should be 2.0")

    def test_timesheet_by_task_report(self):

        res = self.env['account.analytic.line'].sudo().read_group(['|', ('project_id', '=', self.project.id), ('project_id', '=', self.second_project.id)], ['project_id', 'unit_amount', 'task_id'], ['project_id', 'task_id'], lazy=False)

        # res = self.env['stock.move'].read_group(domain, ['state', 'production_id', 'raw_material_production_id'], ['production_id', 'raw_material_production_id'], lazy=False)
        productions_with_done_move = {}
        for rec in res:
            production_record = rec['project_id'] or rec['task_id']
            if production_record:
                productions_with_done_move[production_record[0]] = True
        import pdb; pdb.set_trace()
        # attendances = sorted([DummyAttendance(group['hour_from'], group['hour_to'], group['dayofweek'], group['day_period'], group['week_type']) for group in attendances], key=lambda att: (att.dayofweek, att.day_period != 'morning'))
        timesheet_unit_amount_dict = defaultdict(float)
        timesheet_unit_amount_dict.update({data['project_id'][0]: data['unit_amount'] for data in group_data})

        self.assertEqual(len(timesheet_unit_amount_dict), 2, "there should be two record in report")
        self.assertEqual(timesheet_unit_amount_dict.get(self.project.id), 2.0, "unit amount for project should be 1")
        self.assertEqual(timesheet_unit_amount_dict.get(self.second_project.id), 1.0, "unit amount for second_project should be 2.0")
