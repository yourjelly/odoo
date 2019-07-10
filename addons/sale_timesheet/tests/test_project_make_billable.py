# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.sale_timesheet.tests.common import TestCommonSaleTimesheetNoChart
from odoo.exceptions import UserError


class TestProjectMakeBillable(TestCommonSaleTimesheetNoChart):
    """ This test suite checks the convertion of an existing non billble project to a billable project (with different rate methods), using the wizard.
        We first create the project, a task a some timesheet. Then make it billable and check the impact on project, tasks and timesheets.
    """

    @classmethod
    def setUpClass(cls):
        super(TestProjectMakeBillable, cls).setUpClass()
        # set up
        cls.setUpServiceProducts()
        cls.setUpEmployees()
        cls.employee_tde = cls.env['hr.employee'].create({
            'name': 'Employee TDE',
            'timesheet_cost': 42,
        })

        cls.partner_2 = cls.env['res.partner'].create({
            'name': 'Customer from the South',
            'email': 'customer.usd@south.com',
            'customer': True,
            'property_account_payable_id': cls.account_payable.id,
            'property_account_receivable_id': cls.account_receivable.id,
        })

        # Projects: at least one per billable type
        Project = cls.env['project.project'].with_context(tracking_disable=True)
        cls.project_subtask = Project.create({
            'name': "Sub Task Project (non billable)",
            'allow_timesheets': True,
            'billable_type': 'no',
            'partner_id': False,
        })
        cls.project_non_billable = Project.create({
            'name': "Non Billable Project",
            'allow_timesheets': True,
            'billable_type': 'no',
            'partner_id': False,
            'subtask_project_id': cls.project_subtask.id,
        })

        # create a task and 2 timesheets in non billable project
        Timesheet = cls.env['account.analytic.line']
        Task = cls.env['project.task'].with_context(tracking_disable=True)
        cls.task_non_billable = Task.with_context(default_project_id=cls.project_non_billable.id).create({
            'name': 'task in project billed at task rate',
            'partner_id': cls.project_non_billable.partner_id.id,
            'planned_hours': 11,
        })
        cls.timesheet1 = Timesheet.create({
            'name': 'Test Line Manager',
            'project_id': cls.task_non_billable.project_id.id,
            'task_id': cls.task_non_billable.id,
            'unit_amount': 3,
            'employee_id': cls.employee_manager.id,
        })
        cls.timesheet2 = Timesheet.create({
            'name': 'Test Line User',
            'project_id': cls.task_non_billable.project_id.id,
            'task_id': cls.task_non_billable.id,
            'unit_amount': 2,
            'employee_id': cls.employee_user.id,
        })

    def test_make_billable_at_task_rate(self):
        """ Starting from a non billable project, make it billable at "task rate", using the wizard """

        # create wizard
        wizard = self.env['project.create.sale.order'].with_context(active_id=self.project_non_billable.id, active_model='project.project').create({
            'billable_type': 'task_rate',
        })

        self.assertEqual(self.project_non_billable.billable_type, 'no', "The project should not be at task rate yet")
        self.assertFalse(wizard.partner_id, "The wizard should not have a partner set as the project is billed at task rate")

        # create the SO from the project
        wizard.action_make_billable()

        self.assertEqual(self.project_non_billable.billable_type, 'task_rate', "The project should be 'task rate' billable")
        self.assertEqual(self.task_non_billable.billable_type, 'task_rate', "The task should be 'task rate' billable")
        self.assertFalse(self.project_non_billable.sale_line_id, "The project should not be linked to a sale order line, as the rate depends on the task")
        self.assertFalse(self.task_non_billable.sale_line_id, "The task should not be linked to a sale order line, as it needs to be set manually per task")

        self.assertFalse(self.timesheet1.so_line, "The timesheet 1 of the task should not be attach to SOL as the task rate is still not defined.")
        self.assertFalse(self.timesheet2.so_line, "The timesheet 2 of the task should not be attach to SOL as the task rate is still not defined.")

        # TODO JEM: test of create sale order from task

    def test_make_billable_at_project_rate(self):
        """ Starting from a non billable project, make it billable at "project rate", using the wizard """
        # set a customer on the project
        self.project_non_billable.write({
            'partner_id': self.partner_2.id
        })

        # create wizard
        wizard = self.env['project.create.sale.order'].with_context(active_id=self.project_non_billable.id, active_model='project.project').create({
            'product_id': self.product_delivery_timesheet3.id,  # product creates new T in new P
            'price_unit': self.product_delivery_timesheet3.list_price,
            'billable_type': 'project_rate',
        })

        self.assertEqual(self.project_non_billable.billable_type, 'no', "The project should still be non billable")
        self.assertEqual(wizard.partner_id, self.project_non_billable.partner_id, "The wizard should have the same partner as the project")

        # create the SO from the project
        action = wizard.action_make_billable()
        sale_order = self.env['sale.order'].browse(action['res_id'])

        self.assertEqual(self.project_non_billable.billable_type, 'project_rate', "The project should be 'project rate' billable")
        self.assertEqual(self.task_non_billable.billable_type, 'project_rate', "The task should be 'project rate' billable")

        self.assertEqual(sale_order.partner_id, self.project_non_billable.partner_id, "The customer of the SO should be the same as the project")
        self.assertEqual(len(sale_order.order_line), 1, "The SO should have 1 line")
        self.assertEqual(sale_order.order_line.product_id, wizard.product_id, "The product of the only SOL should be the selected on the wizard")
        self.assertEqual(sale_order.order_line.project_id, self.project_non_billable, "SOL should be linked to the project")
        self.assertTrue(sale_order.order_line.task_id, "The SOL creates a task as they were no task already present in the project (system limitation)")
        self.assertEqual(sale_order.order_line.task_id.project_id, self.project_non_billable, "The created task should be in the project")
        self.assertEqual(sale_order.order_line.qty_delivered, self.timesheet1.unit_amount + self.timesheet2.unit_amount, "The create SOL should have an delivered quantity equals to the sum of tasks'timesheets")

    def test_make_billable_at_employee_rate(self):
        """ Starting from a non billable project, make it billable at employee rate, using the wizard """
        # set a customer on the project
        self.project_non_billable.write({
            'partner_id': self.partner_2.id
        })

        # create wizard
        wizard = self.env['project.create.sale.order'].with_context(active_id=self.project_non_billable.id, active_model='project.project').create({
            'billable_type': 'employee_rate',
            'partner_id': self.partner_2.id,
            'line_ids': [
                (0, 0, {'product_id': self.product_delivery_timesheet1.id, 'price_unit': 15, 'employee_id': self.employee_tde.id}),  # product creates no T
                (0, 0, {'product_id': self.product_delivery_timesheet3.id, 'price_unit': self.product_delivery_timesheet3.list_price, 'employee_id': self.employee_user.id}),  # product creates new T in new P
            ]
        })

        self.assertEqual(self.project_non_billable.billable_type, 'no', "The project should still be non billable")
        self.assertEqual(wizard.partner_id, self.project_non_billable.partner_id, "The wizard should have the same partner as the project")
        self.assertEqual(wizard.project_id, self.project_non_billable, "The wizard'project should be the non billable project")

        # create wizard (missing rate for "employee manager" that already have timesheets)
        with self.assertRaises(UserError):
            wizard.action_make_billable()
        wizard.write({'line_ids': [(0, 0, {'product_id': self.product_delivery_timesheet1.id, 'price_unit': 15, 'employee_id': self.employee_manager.id})]})  # product creates no T (same product than previous one)

        # create the SO from the project
        action = wizard.action_make_billable()
        sale_order = self.env['sale.order'].browse(action['res_id'])

        self.assertEqual(self.project_non_billable.billable_type, 'employee_rate', "The project should be 'employee rate' billable")
        self.assertEqual(sale_order.partner_id, self.project_non_billable.partner_id, "The customer of the SO should be the same as the project")
        self.assertEqual(len(sale_order.order_line), 2, "The SO should have 2 lines, as in wizard map there were 2 time the same product with the same price (for 2 different employees)")
        self.assertEqual(len(self.project_non_billable.sale_line_employee_ids), 3, "The project have 3 lines in its map")
        self.assertEqual(self.project_non_billable.sale_line_id, sale_order.order_line[0], "The wizard sets sale line fallbakc on project as the first of the list")
        self.assertEqual(self.task_non_billable.sale_line_id, sale_order.order_line[0], "The wizard sets sale line fallback on tasks")
        self.assertEqual(self.task_non_billable.partner_id, wizard.partner_id, "The wizard sets the customer on tasks to make SOL line field visible")

        line1 = sale_order.order_line.filtered(lambda sol: sol.product_id == self.product_delivery_timesheet1)
        line2 = sale_order.order_line.filtered(lambda sol: sol.product_id == self.product_delivery_timesheet3)

        self.assertTrue(line1, "Sale line 1 with product 1 should exists")
        self.assertTrue(line2, "Sale line 2 with product 3 should exists")

        self.assertFalse(line1.project_id, "Sale line 1 should be linked to the 'non billable' project")
        self.assertEqual(line2.project_id, self.project_non_billable, "Sale line 3 should be linked to the 'non billable' project")
        self.assertEqual(line1.price_unit, 15, "The unit price of SOL 1 should be 15")
        self.assertEqual(line1.product_uom_qty, 0, "The ordered qty of SOL 1 should be one")
        self.assertEqual(line2.product_uom_qty, 0, "The ordered qty of SOL 1 should be one")

        self.assertEqual(self.project_non_billable.sale_line_employee_ids.mapped('sale_line_id'), sale_order.order_line, "The SO lines of the map should be the same of the sales order")
        self.assertEqual(self.timesheet1.so_line, line1, "Timesheet1 should be linked to sale line 1, as employee manager create the timesheet")
        self.assertEqual(self.timesheet2.so_line, line2, "Timesheet2 should be linked to sale line 2, as employee tde create the timesheet")
        self.assertEqual(self.timesheet1.unit_amount, line1.qty_delivered, "Sale line 1 should have a delivered qty equals to the sum of its linked timesheets")
        self.assertEqual(self.timesheet2.unit_amount, line2.qty_delivered, "Sale line 2 should have a delivered qty equals to the sum of its linked timesheets")
