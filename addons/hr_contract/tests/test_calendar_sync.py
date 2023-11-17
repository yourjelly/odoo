# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.fields import Date
from odoo.addons.hr_contract.tests.common import TestContractCommon


class TestContractCalendars(TestContractCommon):

    @classmethod
    def setUpClass(cls):
        super(TestContractCalendars, cls).setUpClass()
        cls.calendar_richard = cls.env['resource.calendar'].create({'name': 'Calendar of Richard'})
        cls.employee.resource_calendar_id = cls.calendar_richard

        cls.calendar_35h = cls.env['resource.calendar'].create({'name': '35h calendar'})

        cls.contract_cdd = cls.env['hr.contract'].create({
            'date_end': Date.to_date('2015-11-15'),
            'date_start': Date.to_date('2015-01-01'),
            'name': 'First CDD Contract for Richard',
            'resource_calendar_id': cls.calendar_35h.id,
            'wage': 5000.0,
            'employee_id': cls.employee.id,
            'state': 'close',
        })

    def test_contract_state_incoming_to_open(self):
        # Employee's calendar should change
        self.assertEqual(self.employee.resource_calendar_id, self.calendar_richard)
        self.contract_cdd.state = 'open'
        self.assertEqual(self.employee.resource_calendar_id, self.contract_cdd.resource_calendar_id, "The employee should have the calendar of its contract.")
