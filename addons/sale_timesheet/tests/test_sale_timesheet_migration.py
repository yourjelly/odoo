# -*- coding: utf-8 -*-

from odoo.tests import tagged, Form
from odoo.addons.account.tests.account_test_no_chart import TestAccountNoChartCommon


@tagged('-standard', 'migration', 'post_install')
class MigTestSaleTimesheet(TestAccountNoChartCommon):

    def test_timesheet_order(self):
        self.env['ir.config_parameter'].sudo().set_param('uom.group_uom', '1')

        # 1. Create a Partner for sale order
        partner_form = Form(self.env['res.partner'])
        partner_form.company_type = 'company'
        partner_form.name = 'odoo'
        partner_form.property_account_receivable_id = self.account_receivable
        partner_form.property_account_payable_id = self.account_payable

        partner = partner_form.save()

        # 2. Create a product for sale order
        product_form = Form(self.env['product.template'], view='product.product_template_only_form_view')
        product_form.name = 'Consulting Hours'
        product_form.type = 'service'
        product_form.service_type = 'timesheet'
        product_form.standard_price = 50
        product_form.uom_id = self.env.ref('uom.product_uom_hour')
        product_form.service_policy = 'delivered_timesheet'
        product_form.service_tracking = 'task_new_project'

        product = product_form.save()

        # 3. Create a sale order
        order_form = Form(self.env['sale.order'])
        order_form.partner_id = partner
        with order_form.order_line.new() as line:
            line.name = product.name
            line.product_id = product.product_variant_ids[0]
            line.product_uom_qty = 10

        # save sale order
        sale_order = order_form.save()

        # confirm sale order
        sale_order.action_confirm()

        # check sale order state
        self.assertEquals(sale_order.state, 'sale')

        # check project_ids for sale order
        self.assertEquals(len(sale_order.project_ids), 1, 'Project should be created for the SO')

        # check tasks_ids for sale order
        self.assertEquals(len(sale_order.tasks_ids), 1, 'Task should be created for the SO')

        # update timesheet for sale order
        self.env['account.analytic.line'].create({
            'name': 'Test Line',
            # assume it here is single record of project and task
            'project_id': sale_order.project_ids.id,
            'task_id': sale_order.tasks_ids.id,
            'unit_amount': 01.00,
        })

        self.assertEqual(sale_order.timesheet_count, 01.00, "Timesheet should be 01.00 Hour")