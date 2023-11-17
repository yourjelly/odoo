# # -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from .common import TestWorkEntryBase

from datetime import date, datetime, time

from odoo.tests import tagged

@tagged('-at_install', 'post_install')
class TestGlobalTimeOff(TestWorkEntryBase):

    def test_gto_other_calendar(self):
        # Tests that a global time off in another calendar does not affect work entry generation
        #  for other calendars
        other_calendar = self.env['resource.calendar'].create({
            'name': 'other calendar',
        })
        start = date(2018, 1, 1)
        end = date(2018, 1, 1)
        leave = self.env['resource.public.leave'].create({
            'date_from': start,
            'date_to': end,
            'calendar_ids': other_calendar.ids,
            'work_entry_type_id': self.work_entry_type_leave.id,
        })
        contract = self.richard_emp.contract_ids
        contract.state = 'open'
        contract.date_generated_from = start
        contract.date_generated_to = start
        work_entries = contract.generate_work_entries(start.date(), end.date())
        self.assertEqual(work_entries.work_entry_type_id.id, contract._get_default_work_entry_type_id())
        work_entries.unlink()
        contract.date_generated_from = start
        contract.date_generated_to = start
        leave.calendar_id = contract.resource_calendar_id
        work_entries = contract.generate_work_entries(start.date(), end.date())
        self.assertEqual(work_entries.work_entry_type_id, leave.work_entry_type_id)

    def test_gto_no_calendar(self):
        start = date(2018, 1, 1)
        end = date(2018, 1, 1)
        leave = self.env['resource.public.leave'].create({
            'date_from': start,
            'date_to': end,
            'work_entry_type_id': self.work_entry_type_leave.id,
        })
        contract = self.richard_emp.contract_ids
        contract.state = 'open'
        contract.date_generated_from = datetime.combine(start, time.min)
        contract.date_generated_to = datetime.combine(start, time.min)
        work_entries = contract.generate_work_entries(start, end)
        self.assertEqual(work_entries.work_entry_type_id, leave.work_entry_type_id)
