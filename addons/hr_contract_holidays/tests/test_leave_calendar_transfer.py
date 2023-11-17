# Part of Odoo. See LICENSE file for full copyright and licensing details.

from freezegun import freeze_time

from odoo.fields import Datetime, Date
from odoo.addons.hr_contract.tests.common import TestContractCommon


class TestLeaveContractTransfer(TestContractCommon):

    @classmethod
    def setUpClass(cls):
        super(TestLeaveContractTransfer, cls).setUpClass()

        cls.calendar_1 = cls.env['resource.calendar'].create({'name': 'calendar 1'})
        cls.calendar_2 = cls.env['resource.calendar'].create({'name': 'calendar 2'})

        cls.leave_type = cls.env['hr.leave.type'].create({
            'name': 'Unpaid leave',
            'work_entry_type_id': cls.work_entry_type_unpaid.id,
            'time_type': 'leave',
            'requires_allocation': 'no',
        })

        cls.first_contract = cls.env['hr.contract'].create({
            'date_start': Date.to_date('2015-01-01'),
            'name': 'First CDD Contract for Richard',
            'resource_calendar_id': cls.calendar_1.id,
            'wage': 5000.0,
            'employee_id': cls.employee.id,
            'state': 'open',
        })

    def test_contract_transfer_leaves(self):

        def create_leave(start, end, employee):
            return self.env['employee.calendar.leaves'].create({
                'name': 'leave name',
                'holiday_status_id': self.leave_type,
                'date_from': start,
                'date_to': end,
                'employee_id': employee.id,
            })

        start = Datetime.to_datetime('2015-11-17 07:00:00')
        end = Datetime.to_datetime('2015-11-20 18:00:00')
        leave1 = create_leave(start, end, self.employee)
        self.assertEqual(leave1.resource_calendar_id, self.calendar_1, "It should be calendar 1")

        start = Datetime.to_datetime('2016-11-25 07:00:00')
        end = Datetime.to_datetime('2016-11-28 18:00:00')
        leave2 = create_leave(start, end, self.employee)
        self.assertEqual(leave2.resource_calendar_id, self.calendar_1, "It should be calendar 1")

        start = Datetime.to_datetime('2017-11-25 07:00:00')
        end = Datetime.to_datetime('2017-11-28 18:00:00')
        leave3 = create_leave(start, end, self.employee)
        self.assertEqual(leave3.resource_calendar_id, self.calendar_1, "It should be calendar 1")

        self.first_contract.write({
            'date_end': Date.to_date('2015-12-31'),
        })

        self.contract_cdi = self.env['hr.contract'].create({
            'date_start': Date.to_date('2016-01-01'),
            'date_end': Date.to_date('2016-12-31'),
            'name': 'CDI Contract for Richard',
            'resource_calendar_id': self.calendar_2.id,
            'wage': 5000.0,
            'employee_id': self.employee.id,
            'state': 'draft',
            'kanban_state': 'done',
        })

        with freeze_time('2016-01-01'):
            self.env['hr.contract'].update_state()

            self.assertEqual(leave1.resource_calendar_id, self.calendar_1, "It should stay in Richard's calendar")
            self.assertEqual(leave2.resource_calendar_id, self.calendar_2, "It should be transfered to the other calendar")
            self.assertEqual(leave3.resource_calendar_id, self.calendar_1, "It should stay in Company's calendar")
