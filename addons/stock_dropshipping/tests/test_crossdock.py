# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests import common, Form
from odoo.tools import mute_logger


class TestCrossdock(common.TransactionCase):

    def setUp(self):
        super(TestCrossdock, self).setUp()
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

    def test_00_crossdock(self):

        # Create a supplier
        supplier_crossdock = self.env['res.partner'].with_user(self.user_stock_manager).create({'name': "Crossdocking supplier"})

        # I first create a warehouse with pick-pack-ship and reception in 2 steps
        wh_f = Form(self.env['stock.warehouse'].with_user(self.user_stock_manager))
        wh_f.name = 'WareHouse PickPackShip'
        wh_f.code = 'whpps'
        wh_f.reception_steps = 'two_steps'
        wh_f.delivery_steps = 'pick_pack_ship'
        wh_pps = wh_f.save()

        # Check that cross-dock route is active
        self.assertTrue(wh_pps.crossdock_route_id.active,
            "Crossdock route should be active when reception_steps is not in 'single_step'")

        p_f = Form(self.env['product.template'].with_user(self.user_stock_manager))
        p_f.name = 'PCE'
        p_f.type = 'product'
        p_f.categ_id = self.env.ref('product.product_category_1')
        p_f.list_price = 100.0
        with p_f.seller_ids.new() as seller:
            seller.name = supplier_crossdock
        p_f.route_ids.add(wh_pps.crossdock_route_id)
        cross_shop_product = p_f.save()

        p_f.standard_price = 70.0

        # Create a sales order with a line of 100 PCE incoming shipment with route_id crossdock shipping
        so_form = Form(self.env['sale.order'].with_user(self.user_salesmanager))
        so_form.partner_id = self.env['res.partner'].with_user(self.user_stock_manager).create({'name': 'My Test Partner'})
        so_form.warehouse_id = wh_pps

        with mute_logger('odoo.tests.common.onchange'):
            # otherwise complains that there's not enough inventory and
            # apparently that's normal according to @jco and @sle
            with so_form.order_line.new() as line:
                line.product_id = cross_shop_product.product_variant_ids
                line.product_uom_qty = 100.0
            sale_order_crossdock = so_form.save()

        # Confirm sales order
        sale_order_crossdock.action_confirm()

        # Run the scheduler
        self.env['procurement.group'].sudo().run_scheduler()

        # Check a quotation was created for the created supplier and confirm it
        po = self.env['purchase.order'].with_user(self.users_purchase_manager).search([
            ('partner_id', '=', supplier_crossdock.id),
            ('state', '=', 'draft')
        ])
        self.assertTrue(po, "an RFQ should have been created by the scheduler")
        po.button_confirm()
