from odoo.tests import Form, tagged
from odoo.addons.hr_timesheet.tests.test_timesheet import TestCommonTimesheet

@tagged('-at_install', 'post_install')
class TestProjectUpdate(TestCommonTimesheet):

    def test_project_update_timesheets(self):
        self.env['account.analytic.line'].with_user(self.user_employee).create([
            {'unit_amount': 5.0, 'project_id': self.project_customer.id, 'product_uom_id': False, 'task_id': self.task1.id},
            {'unit_amount': 5.0, 'project_id': self.project_customer.id, 'product_uom_id': False, 'task_id': self.task2.id},
        ])
        self.task1.write({'state': '1_done'})
        self.task2.write({'state': '1_done'})

        with Form(self.env['project.update'].with_context({'default_project_id': self.project_customer.id})) as update_form:
            update_form.name = "Test"
            update_form.progress = 100
        update = update_form.save()

        self.assertEqual(update.timesheet_time, self.project_customer.total_timesheet_time, msg="At creation of project update the total_timesheet_time in the project and timesheet_time in project update should be equal")
