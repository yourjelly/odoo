# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, tools
from odoo.addons.stock_account.tests.common import StockAccountTestCommon
from odoo.modules.module import get_module_resource
from odoo.tests import common, Form


class TestLifoPrice(StockAccountTestCommon):

    def setUp(self):
        super(TestLifoPrice, self).setUp()
        self.main_company = self.env.ref('base.main_company')
        Users = self.env['res.users'].with_context(no_reset_password=True)

        self.user_stock_user = Users.create({
            'name': 'Pauline Poivraisselle',
            'login': 'pauline',
            'email': 'p.p@example.com',
            'notification_type': 'inbox',
            'groups_id': [(6, 0, [self.env.ref('stock.group_stock_user').id])]})
        self.user_stock_manager = Users.create({
            'name': 'Julie Tablier',
            'login': 'julie',
            'email': 'j.j@example.com',
            'notification_type': 'inbox',
            'groups_id': [(6, 0, [self.env.ref('stock.group_stock_manager').id])]})
        self.user_salesmanager = Users.create({
            'name': 'Andrew Manager',
            'login': 'manager',
            'email': 'a.m@example.com',
            'groups_id': [(6, 0, [self.env.ref('sales_team.group_sale_manager').id])]})
        self.users_purchase_manager = Users.create({
            'company_id': self.main_company.id,
            'name': "Purchase Manager",
            'login': "pm",
            'email': "purchasemanager@yourcompany.com",
            'groups_id': [(6, 0, [self.env.ref('purchase.group_purchase_manager').id])]})
        self.env = self.env(user=self.user_stock_user)

    def test_lifoprice(self):

        # Set product category removal strategy as LIFO
        product_category_001 = self.env['product.category'].with_user(self.user_stock_manager).create({
            'name': 'Lifo Category',
            'removal_strategy_id': self.env.ref('stock.removal_lifo').id,
            'property_valuation': 'real_time',
            'property_cost_method': 'fifo',
        })
        res_partner_3 = self.env['res.partner'].with_user(self.user_stock_manager).create({'name': 'My Test Partner'})

        # Set a product as using lifo price
        product_form = Form(self.env['product.product'].with_user(self.user_stock_manager))
        product_form.default_code = 'LIFO'
        product_form.name = 'LIFO Ice Cream'
        product_form.type = 'product'
        product_form.categ_id = product_category_001
        product_form.lst_price = 100.0
        product_form.uom_id = self.env.ref('uom.product_uom_kgm')
        product_form.uom_po_id = self.env.ref('uom.product_uom_kgm')
        # these are not available (visible) in either product or variant
        # for views, apparently from the UI you can only set the product
        # category (or hand-assign the property_* version which seems...)
        # product_form.categ_id.valuation = 'real_time'
        # product_form.categ_id.property_cost_method = 'fifo'
        product_form.categ_id.property_stock_account_input_categ_id = self.o_expense
        product_form.categ_id.property_stock_account_output_categ_id = self.o_income
        product_lifo_icecream = product_form.save()

        product_lifo_icecream.standard_price = 70.0

        # I create a draft Purchase Order for first in move for 10 pieces at 60 euro
        order_form = Form(self.env['purchase.order'].with_user(self.users_purchase_manager))
        order_form.partner_id = res_partner_3
        with order_form.order_line.new() as line:
            line.product_id = product_lifo_icecream
            line.product_qty = 10.0
            line.price_unit = 60.0
        purchase_order_lifo1 = order_form.save()

        # I create a draft Purchase Order for second shipment for 30 pieces at 80 euro
        order2_form = Form(self.env['purchase.order'].with_user(self.users_purchase_manager))
        order2_form.partner_id = res_partner_3
        with order2_form.order_line.new() as line:
            line.product_id = product_lifo_icecream
            line.product_qty = 30.0
            line.price_unit = 80.0
        purchase_order_lifo2 = order2_form.save()

        # I confirm the first purchase order
        purchase_order_lifo1.button_confirm()

        # I check the "Approved" status of purchase order 1
        self.assertEqual(purchase_order_lifo1.state, 'purchase')

        # Process the receipt of purchase order 1
        purchase_order_lifo1.picking_ids[0].move_lines.quantity_done = purchase_order_lifo1.picking_ids[0].move_lines.product_qty
        purchase_order_lifo1.picking_ids[0].button_validate()

        # I confirm the second purchase order
        purchase_order_lifo2.button_confirm()

        # Process the receipt of purchase order 2
        purchase_order_lifo2.picking_ids[0].move_lines.quantity_done = purchase_order_lifo2.picking_ids[0].move_lines.product_qty
        purchase_order_lifo2.picking_ids[0].button_validate()

        # Let us send some goods
        out_form = Form(self.env['stock.picking'])
        out_form.picking_type_id = self.env.ref('stock.picking_type_out')
        out_form.immediate_transfer = True
        with out_form.move_ids_without_package.new() as move:
            move.product_id = product_lifo_icecream
            move.quantity_done = 20.0
            move.date_expected = fields.Datetime.now()
        outgoing_lifo_shipment = out_form.save()

        # I assign this outgoing shipment
        outgoing_lifo_shipment.action_assign()

        # Process the delivery of the outgoing shipment
        outgoing_lifo_shipment.button_validate()

        # Check if the move value correctly reflects the fifo costing method
        self.assertEqual(outgoing_lifo_shipment.with_user(self.user_stock_manager).move_lines.stock_valuation_layer_ids.value, -1400.0, 'Stock move value should have been 1400 euro')
