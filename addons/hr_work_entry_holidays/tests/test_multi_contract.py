# # -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import datetime, date, time
from odoo.exceptions import ValidationError
from odoo.tests import tagged
from odoo.addons.hr_work_entry_holidays.tests.common import TestWorkEntryHolidaysBase


@tagged('work_entry_multi_contract')
class TestWorkEntryHolidaysMultiContract(TestWorkEntryHolidaysBase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.leave_type = cls.env['hr.leave.type'].create({
            'name': 'Legal Leaves',
            'time_type': 'leave',
            'requires_allocation': 'no',
            'work_entry_type_id': cls.work_entry_type_leave.id
        })

    def create_leave(self, start, end):
        work_days_data = self.jules_emp._get_work_days_data_batch(start, end)
        return self.env['hr.leave'].create({
            'name': 'Doctor Appointment',
            'employee_id': self.jules_emp.id,
            'holiday_status_id': self.leave_type.id,
            'date_from': start,
            'date_to': end,
            'number_of_days': work_days_data[self.jules_emp.id]['days'],
        })

    def test_multi_contract_holiday(self):
        # Leave during second contract
        leave = self.create_leave(datetime(2015, 11, 17, 7, 0), datetime(2015, 11, 20, 18, 0))
        leave.action_approve()
        start = date(2015, 11, 1)
        end_generate = date(2015, 11, 30)
        work_entries = self.jules_emp.contract_ids.generate_work_entries(start, end_generate)
        work_entries.action_validate()
        work_entries = work_entries.filtered(lambda we: we.contract_id == self.contract_cdi)

        work = work_entries.filtered(lambda line: line.work_entry_type_id == self.env.ref('hr_work_entry.work_entry_type_attendance'))
        leave = work_entries.filtered(lambda line: line.work_entry_type_id == self.work_entry_type_leave)
        self.assertEqual(sum(work.mapped('duration')), 49, "It should be 49 hours of work this month for this contract")
        self.assertEqual(sum(leave.mapped('duration')), 28, "It should be 28 hours of leave this month for this contract")
