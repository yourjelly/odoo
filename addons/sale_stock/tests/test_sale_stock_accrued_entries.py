# -*- coding: utf-8 -*-
from itertools import product
from odoo.addons.account.tests.test_accrued_orders_common import TestAccruedOrdersCommon
from odoo.tests import tagged
from odoo.exceptions import UserError
from odoo import fields, Command


@tagged('post_install', '-at_install')
class TestAccruedSaleOrders(TestAccruedOrdersCommon):

    @classmethod
    def setUpClass(cls, chart_template_ref=None):
        super().setUpClass(chart_template_ref=chart_template_ref)

        cls.stock_sale_order = cls.env['sale.order'].with_context(tracking_disable=True).create({
            'partner_id': cls.partner_a.id,
            'order_line': [
                cls._get_order_line_command(cls.product_order),
                cls._get_order_line_command(cls.service_order),
            ]
        })

        supplier_location = cls.env.ref('stock.stock_location_suppliers')  # client
        stock_location = cls.env['stock.location'].search([('company_id', '=', cls.company_data['company'].id)], limit=1)
        picking_type_in = cls.env['stock.warehouse'].search(
            [('company_id', '=', cls.company_data['company'].id)],
            limit=1,
        ).pick_type_id

        cls.picking = cls.env['stock.picking'].create({
            'location_id': supplier_location.id,
            'location_dest_id': stock_location.id,
            'picking_type_id': picking_type_in.id,
        })

        cls.env['stock.move'].create({
            'name': cls.product_order.name,
            'product_id': cls.product_order.id,
            'product_uom_qty': 2,
            'product_uom': cls.product_order.uom_id.id,
            'picking_id': cls.picking.id,
            'location_id': stock_location.id,
            'location_dest_id': supplier_location.id,
            'date': fields.Date.to_date('2020-01-01'),
        })
        cls.env['stock.move'].create({
            'name': cls.product_order.name,
            'product_id': cls.product_order.id,
            'product_uom_qty': 2,
            'product_uom': cls.product_order.uom_id.id,
            'picking_id': cls.picking.id,
            'location_id': stock_location.id,
            'location_dest_id': supplier_location.id,
            'date': fields.Date.to_date('2020-01-03'),
        })

    def test_sale_stock_accruals(self):
        self.sale_order.picking_ids |= self.picking
        self.wizard.date = fields.Date.to_date('2020-01-01')
        lines = self.env['account.move'].search(self.wizard.create_entries()['domain']).line_ids
        lines
