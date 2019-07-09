# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.sale_timesheet.tests.common import TestCommonSaleTimesheetNoChart
from odoo.exceptions import UserError


class TestProjectBilling(TestCommonSaleTimesheetNoChart):
    """ This test suite provide checks for miscellaneous small things. """

    @classmethod
    def setUpClass(cls):
        super(TestProjectBilling, cls).setUpClass()
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

        # Sale Order 1, no project/task created, used to timesheet at employee rate
        SaleOrder = cls.env['sale.order'].with_context(tracking_disable=True)
        SaleOrderLine = cls.env['sale.order.line'].with_context(tracking_disable=True)
        cls.sale_order_1 = SaleOrder.create({
            'partner_id': cls.partner_customer_usd.id,
            'partner_invoice_id': cls.partner_customer_usd.id,
            'partner_shipping_id': cls.partner_customer_usd.id,
        })

        cls.so1_line_order_no_task = SaleOrderLine.create({
            'name': cls.product_order_timesheet1.name,
            'product_id': cls.product_order_timesheet1.id,
            'product_uom_qty': 10,
            'product_uom': cls.product_order_timesheet1.uom_id.id,
            'price_unit': cls.product_order_timesheet1.list_price,
            'order_id': cls.sale_order_1.id,
        })

        cls.so1_line_deliver_no_task = SaleOrderLine.create({
            'name': cls.product_delivery_timesheet1.name,
            'product_id': cls.product_delivery_timesheet1.id,
            'product_uom_qty': 10,
            'product_uom': cls.product_delivery_timesheet1.uom_id.id,
            'price_unit': cls.product_delivery_timesheet1.list_price,
            'order_id': cls.sale_order_1.id,
        })
        # Sale Order 2, creates 2 project billed at task rate
        cls.sale_order_2 = SaleOrder.create({
            'partner_id': cls.partner_2.id,
            'partner_invoice_id': cls.partner_2.id,
            'partner_shipping_id': cls.partner_2.id,
        })
        cls.so2_line_deliver_project_task = SaleOrderLine.create({
            'order_id': cls.sale_order_2.id,
            'name': cls.product_delivery_timesheet3.name,
            'product_id': cls.product_delivery_timesheet3.id,
            'product_uom_qty': 5,
            'product_uom': cls.product_delivery_timesheet3.uom_id.id,
            'price_unit': cls.product_delivery_timesheet3.list_price
        })
        cls.so2_line_deliver_project_template = SaleOrderLine.create({
            'order_id': cls.sale_order_2.id,
            'name': cls.product_delivery_timesheet5.name,
            'product_id': cls.product_delivery_timesheet5.id,
            'product_uom_qty': 7,
            'product_uom': cls.product_delivery_timesheet5.uom_id.id,
            'price_unit': cls.product_delivery_timesheet5.list_price
        })
        cls.sale_order_2.action_confirm()

        # Project non billable
        Project = cls.env['project.project'].with_context(tracking_disable=True)
        cls.project_subtask = Project.create({
            'name': "Sub Task Project (non billable)",
            'allow_timesheets': True,
            'billable_type': 'no',
            'partner_id': False,
        })
        # Project at Task Rate
        cls.project_task_rate = Project.create({
            'name': "Task Rate Project",
            'allow_timesheets': True,
            'billable_type': 'no',
            'partner_id': cls.partner_customer_usd.id,
            'subtask_project_id': cls.project_subtask.id,
            'billable_type': 'task_rate',
        })
        # Project at Employee Rate
        cls.project_employee_rate = Project.create({
            'name': "Project billed at Employee Rate",
            'allow_timesheets': True,
            'billable_type': 'employee_rate',
            'sale_order_id': cls.sale_order_1.id,
            'partner_id': cls.sale_order_1.partner_id.id,
            'subtask_project_id': cls.project_subtask.id,
            'billable_type': 'employee_rate',
            'sale_line_employee_ids': [
                (0, 0, {
                    'sale_line_id': cls.so1_line_order_no_task.id,
                    'employee_id': cls.employee_manager.id,
                }),
                (0, 0, {
                    'sale_line_id': cls.so1_line_deliver_no_task.id,
                    'employee_id': cls.employee_user.id,
                }),
            ]
        })
        cls.project_employee_rate_manager = cls.project_employee_rate.sale_line_employee_ids.filtered(lambda line: line.employee_id == cls.employee_manager)
        cls.project_employee_rate_user = cls.project_employee_rate.sale_line_employee_ids.filtered(lambda line: line.employee_id == cls.employee_user)

    # --------------------------------------
    #  Task Rate Billing
    # --------------------------------------

    def test_billing_task_rate(self):
        """ Starting with a project created at 'task rate', check that timesheet and tasks in the project are correclty billed. """
        Task = self.env['project.task'].with_context(tracking_disable=True)
        Timesheet = self.env['account.analytic.line']

        # create a task
        task = Task.with_context(default_project_id=self.project_task_rate.id).create({
            'name': 'first task',
            'partner_id': self.partner_customer_usd.id,
        })
        task._onchange_project()

        self.assertEqual(task.billable_type, 'task_rate', "Task in project 'task rate' should be billed at task rate, even without SOL")
        self.assertFalse(task.sale_line_id, "Task created in a project billed on 'task rate' should not be linked to a SOL by default as project does not have one")
        self.assertEqual(task.partner_id, task.project_id.partner_id, "Task created in a project billed on 'employee rate' should have the same customer as the one from the project")

        # log timesheet on task (non billable for now)
        timesheet1 = Timesheet.create({
            'name': 'Test Line',
            'project_id': task.project_id.id,
            'task_id': task.id,
            'unit_amount': 50,
            'employee_id': self.employee_manager.id,
        })

        self.assertFalse(timesheet1.so_line, "The timesheet should not be linked to the SOL since neither the task nor the project has a rate set.")

        # set the task rate on task
        task.write({
            'sale_line_id': self.so1_line_deliver_no_task.id
        })

        self.assertEqual(task.billable_type, 'task_rate', "Task with its rate should still be billed at task rate")
        self.assertEqual(task.partner_id, task.project_id.partner_id, "Partner task has no change")

        # log timesheet on task
        timesheet2 = Timesheet.create({
            'name': 'Test Line',
            'project_id': task.project_id.id,
            'task_id': task.id,
            'unit_amount': 50,
            'employee_id': self.employee_manager.id,
        })

        self.assertEqual(timesheet2.so_line, task.sale_line_id, "The timesheet should be linked to the SOL associated to the task.")
        self.assertFalse(timesheet1.so_line, "Existing timesheets are not impacted when changing task rate")

        # set the default task rate on project
        self.project_task_rate.write({
            'sale_order_id': self.sale_order_1.id,
            'sale_line_id': self.so1_line_order_no_task.id,
        })

        # create a task
        task2 = Task.with_context(default_project_id=self.project_task_rate.id).create({
            'name': 'second task: a default rate should be set',
            'partner_id': self.partner_customer_usd.id,
        })
        task2._onchange_project()

        self.assertEqual(task2.sale_line_id, self.project_task_rate.sale_line_id, "Task created in a project billed on 'task rate' should be linked to a SOL of the project")
        self.assertEqual(task.sale_line_id, self.so1_line_deliver_no_task, "Existing tasks should not be impacted by setting a default rate on project")

        # create a subtask
        subtask = Task.with_context(default_project_id=self.project_task_rate.subtask_project_id.id).create({
            'name': 'first subtask task',
            'parent_id': task.id,
        })

        self.assertEqual(subtask.billable_type, 'no', "Subtask in a non billable project should be non billable, as it depends on the project on not the parent")
        self.assertEqual(subtask.partner_id, subtask.parent_id.partner_id, "Subtask should have the same customer as the one from their mother")

        # log timesheet on subtask
        timesheet3 = Timesheet.create({
            'name': 'Test Line on subtask',
            'project_id': subtask.project_id.id,
            'task_id': subtask.id,
            'unit_amount': 50,
            'employee_id': self.employee_user.id,
        })

        self.assertFalse(timesheet3.so_line, "The timesheet should not be linked to SOL as the subtask does not have a rate set")

        # move task and subtask into task rate project
        task.write({
            'project_id': self.project_employee_rate.id,
        })
        task._onchange_project()
        subtask.write({
            'project_id': self.project_employee_rate.id,
        })
        subtask._onchange_project()

        self.assertEqual(task.billable_type, 'employee_rate', "Task moved in project 'employee rate' should be billed at employee rate")
        self.assertFalse(task.sale_line_id, "Task moved in a employee rate billable project have empty so line")
        self.assertEqual(task.partner_id, task.project_id.partner_id, "Task created in a project billed on 'employee rate' should have the same customer as the one from the project")

        self.assertEqual(subtask.billable_type, 'employee_rate', "subtask moved in project 'employee rate' should be billed at employee rate")
        self.assertFalse(subtask.sale_line_id, "Subask moved in a employee rate billable project have empty so line")
        self.assertEqual(subtask.partner_id, task.project_id.partner_id, "Subask created in a project billed on 'employee rate' should have the same customer as the one from the project")

    # --------------------------------------
    #  Employee Rate Billing
    # --------------------------------------

    def test_billing_employee_rate(self):
        """ Check task and subtask creation, and timesheeting in a project billed at 'employee rate'. Then move the task into a 'task rate' project. """
        Task = self.env['project.task'].with_context(tracking_disable=True)
        Timesheet = self.env['account.analytic.line']

        # create a task
        task = Task.with_context(default_project_id=self.project_employee_rate.id).create({
            'name': 'first task',
            'partner_id': self.partner_customer_usd.id,
        })

        self.assertEqual(task.billable_type, 'employee_rate', "Task in project 'employee rate' should be billed at employee rate")
        self.assertFalse(task.sale_line_id, "Task created in a project billed on 'employee rate' should not be linked to a SOL")
        self.assertEqual(task.partner_id, task.project_id.partner_id, "Task created in a project billed on 'employee rate' should have the same customer as the one from the project")

        # log timesheet on task
        timesheet1 = Timesheet.create({
            'name': 'Test Line',
            'project_id': task.project_id.id,
            'task_id': task.id,
            'unit_amount': 50,
            'employee_id': self.employee_manager.id,
        })

        self.assertEqual(self.project_employee_rate_manager.sale_line_id, timesheet1.so_line, "The timesheet should be linked to the SOL associated to the Employee manager in the map")
        self.assertEqual(self.project_employee_rate_manager.project_id, timesheet1.project_id, "The timesheet should be linked to the project of the map entry")

        # create a subtask
        subtask = Task.with_context(default_project_id=self.project_employee_rate.subtask_project_id.id).create({
            'name': 'first subtask task',
            'parent_id': task.id,
        })

        self.assertEqual(subtask.billable_type, 'no', "Subtask in non billable project should be non billable too")
        self.assertEqual(subtask.project_id.billable_type, 'no', "The subtask project is non billable even if the subtask is")
        self.assertEqual(subtask.partner_id, subtask.parent_id.partner_id, "Subtask should have the same customer as the one from their mother")

        # log timesheet on subtask
        timesheet2 = Timesheet.create({
            'name': 'Test Line on subtask',
            'project_id': subtask.project_id.id,
            'task_id': subtask.id,
            'unit_amount': 50,
            'employee_id': self.employee_user.id,
        })

        self.assertEqual(subtask.project_id, timesheet2.project_id, "The timesheet is in the subtask project")
        self.assertNotEqual(self.project_employee_rate_user.project_id, timesheet2.project_id, "The timesheet should not be linked to the billing project for the map")
        self.assertFalse(timesheet2.so_line, "The timesheet should not be linked to SOL as the task is in a non billable project")

        # move task into task rate project
        task.write({
            'project_id': self.project_task_rate.id,
        })
        task._onchange_project()

        self.assertEqual(task.billable_type, 'task_rate', "Task in project 'task rate' should be billed at task rate")
        self.assertEqual(task.sale_line_id, self.project_task_rate.sale_line_id, "Task moved in a task rate billable project")
        self.assertEqual(task.partner_id, task.project_id.partner_id, "Task created in a project billed on 'employee rate' should have the same customer as the one from the project")

        # move subtask into task rate project
        subtask.write({
            'project_id': self.project_task_rate.id,
        })

        self.assertEqual(task.billable_type, 'task_rate', "Subtask should keep the billable type from its parent, even when they are moved into another project")
        self.assertEqual(task.sale_line_id, self.project_task_rate.sale_line_id, "Subtask should keep the same sale order line than their mother, even when they are moved into another project")

        # create a second task in employee rate project
        task2 = Task.with_context(default_project_id=self.project_employee_rate.id).create({
            'name': 'first task',
            'partner_id': self.partner_customer_usd.id,
            'sale_line_id': False
        })

        # log timesheet on task in 'employee rate' project without any fallback (no map, no SOL on task, no SOL on project)
        timesheet3 = Timesheet.create({
            'name': 'Test Line',
            'project_id': task2.project_id.id,
            'task_id': task2.id,
            'unit_amount': 3,
            'employee_id': self.employee_tde.id,
        })

        self.assertFalse(timesheet3.so_line, "The timesheet should not be linked to SOL as there is no fallback at all (no map, no SOL on task, no SOL on project)")

        # add a SOL on the project as fallback
        self.project_employee_rate.write({'sale_line_id': self.so1_line_deliver_no_task.id})

        # log timesheet on task in 'employee rate' project wit the project fallback only (no map, no SOL on task, but SOL on project)
        timesheet4 = Timesheet.create({
            'name': 'Test Line ',
            'project_id': task2.project_id.id,
            'task_id': task2.id,
            'unit_amount': 4,
            'employee_id': self.employee_tde.id,
        })

        self.assertEquals(timesheet4.so_line, self.so1_line_deliver_no_task, "The timesheet should be linked to SOL on the project, as no entry for TDE in project map and no SOL on task")
