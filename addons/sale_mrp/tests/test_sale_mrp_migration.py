# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests import tagged, Form
from odoo.addons.account.tests.account_test_no_chart import TestAccountNoChartCommon


@tagged('-standard', 'migration', 'post_install')
class MigTestSaleMrp(TestAccountNoChartCommon):

    def setUp(self):
        super(MigTestSaleMrp, self).setUp()

    def test_sale_mrp_flow(self):

        # search warehouse
        warehouse = self.env['stock.warehouse'].search([('company_id', '=', self.env.user.id)], limit=1)
        route_manufacture = warehouse.manufacture_pull_id.route_id
        route_mto = warehouse.mto_pull_id.route_id

        # 1. create product Wooden Feet
        product_wooden_feet = Form(self.env['product.template'])
        product_wooden_feet.name = 'Wooden Feet'
        product_wooden_feet.type = 'product'
        product_wooden_feet.sale_ok = False
        product_wooden_feet.standard_price = 5.0
        product_feet = product_wooden_feet.save()
        # update product qty for product feet
        # product_id is readonly field in view for that used create method instead of call Form view
        update_qty_feet = self.env['stock.change.product.qty'].create({
            'product_id': product_feet.product_variant_ids.id,
            'product_tmpl_id': product_feet.id,
            'new_quantity': 10.0,
            'location_id': warehouse.lot_stock_id.id})
        update_qty_feet.change_product_qty()

        # 2. create product Wooden Feet
        product_wooden_sheet = Form(self.env['product.template'])
        product_wooden_sheet.name = 'Wooden Sheet'
        product_wooden_sheet.type = 'product'
        product_wooden_sheet.sale_ok = False
        product_wooden_sheet.standard_price = 20.0
        product_sheet = product_wooden_sheet.save()
        # update product qty for product sheet
        # product_id is readonly field in view for that used create method instead of call Form view
        update_qty_sheet = self.env['stock.change.product.qty'].create({
            'product_id': product_sheet.product_variant_ids.id,
            'product_tmpl_id': product_sheet.id,
            'new_quantity': 10.0,
            'location_id': warehouse.lot_stock_id.id})
        update_qty_sheet.change_product_qty()

        # 3. create product Screws
        product_wooden_screw = Form(self.env['product.template'])
        product_wooden_screw.name = 'Wooden Sheet'
        product_wooden_screw.type = 'consu'
        product_wooden_screw.sale_ok = False
        product_wooden_screw.standard_price = 0.1
        product_screw = product_wooden_screw.save()

        # 4. create product Table
        product_table = Form(self.env['product.template'])
        product_table.name = 'Table'
        product_table.type = 'product'
        product_table.invoice_policy = 'delivery'
        product_table.route_ids.clear()
        product_table.route_ids.add(route_manufacture)
        product_table.route_ids.add(route_mto)
        product_table.list_price = 100.0
        product_finished_table = product_table.save()

        # 5. create bom for manufactured product
        product_manufacture = Form(self.env['mrp.bom'])
        product_manufacture.product_tmpl_id = product_finished_table
        product_manufacture.product_qty = 1
        product_manufacure_bom = product_manufacture.save()
        with Form(product_manufacure_bom) as bom:
            with bom.bom_line_ids.new() as line:
                line.product_id = product_screw.product_variant_ids
                line.product_qty = 20.0
            with bom.bom_line_ids.new() as line:
                line.product_id = product_feet.product_variant_ids
                line.product_qty = 4.0
            with bom.bom_line_ids.new() as line:
                line.product_id = product_sheet.product_variant_ids
                line.product_qty = 1.0

        # 6. create partner
        partner = Form(self.env['res.partner'])
        partner.name = 'Odoo'
        partner.company_type = 'company'
        partner_odoo = partner.save()

        # 7. create a sale order for product Table
        sale_order = Form(self.env['sale.order'])
        sale_order.partner_id = partner_odoo
        with sale_order.order_line.new() as line:
            line.product_id = product_finished_table.product_variant_ids
            line.price_unit = 100.0
            line.product_uom_qty = 1.0
        sale_order_odoo = sale_order.save()

        # 8. confirm the sale order
        sale_order_odoo.action_confirm()

        # 9. check the stock picking is created and state is waiting
        self.assertEqual(sale_order_odoo.picking_ids.state, 'waiting')
        manufacturing_order = self.env['mrp.production'].search([('origin', '=', sale_order_odoo.name)])
        self.assertTrue(manufacturing_order, 'Manufacturing order has not been generated')

        # 10. produce the manufacturing order
        produce_form = Form(self.env['mrp.product.produce'].with_context({
                'active_id': manufacturing_order.id,
                'active_ids': [manufacturing_order.id],
            }))
        product_produce = produce_form.save()
        product_produce.do_produce()

        # 11. manufacturing order mark as done
        manufacturing_order.button_mark_done()

        # 12. check the stock picking is in 'ready' state
        self.assertEqual(sale_order_odoo.picking_ids.state, 'assigned')

        # 13. validate the picking
        backorder_wizard_dict = sale_order_odoo.picking_ids.button_validate()
        backorder_wizard = self.env[backorder_wizard_dict['res_model']].browse(backorder_wizard_dict['res_id'])
        backorder_wizard.process()

        # 14. check the delivered qty for sale order
        self.assertEqual(sale_order_odoo.order_line.qty_delivered, 1.0)

        # 15. check the invoice status for sale order
        self.assertEqual(sale_order_odoo.invoice_status, 'to invoice')
