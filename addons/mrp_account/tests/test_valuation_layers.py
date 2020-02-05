# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

""" Implementation of "INVENTORY VALUATION TESTS (With valuation layers)" spreadsheet. """

from odoo.addons.stock_account.tests.test_stockvaluationlayer import TestStockValuationCommon
from odoo.tests import Form


class TestMrpValuationCommon(TestStockValuationCommon):
    @classmethod
    def setUpClass(cls):
        super(TestMrpValuationCommon, cls).setUpClass()
        user_group_stock_user = cls.env.ref('stock.group_stock_user')
        user_group_mrp_manager = cls.env.ref('mrp.group_mrp_manager')
        user_group_mrp_byproducts = cls.env.ref('mrp.group_mrp_byproducts')
        cls.component_category = cls.env['product.category'].with_user(cls.user_stock_manager).create(
            {'name': 'category2'}
        )
        cls.component = cls.env['product.product'].with_user(cls.user_stock_manager).create({
            'name': 'component1',
            'type': 'product',
            'categ_id': cls.component_category.id,
        })
        Users = cls.env['res.users'].sudo().with_context({'no_reset_password': True, 'mail_create_nosubscribe': True})
        cls.user_mrp_manager = Users.create({
            'name': 'Gary Youngwomen',
            'login': 'gary',
            'email': 'g.g@example.com',
            'notification_type': 'inbox',
            'groups_id': [(6, 0, [
                user_group_mrp_manager.id,
                user_group_stock_user.id,
                user_group_mrp_byproducts.id
            ])]})
        cls.bom = cls.env['mrp.bom'].with_user(cls.user_mrp_manager).create({
            'product_id': cls.product1.id,
            'product_tmpl_id': cls.product1.product_tmpl_id.id,
            'product_uom_id': cls.uom_unit.id,
            'product_qty': 1.0,
            'type': 'normal',
            'bom_line_ids': [
                (0, 0, {'product_id': cls.component.id, 'product_qty': 1})
            ]})

    def _make_mo(self, bom, quantity=1):
        mo_form = Form(self.env['mrp.production'].with_user(self.user_mrp_manager))
        mo_form.product_id = bom.product_id
        mo_form.bom_id = bom
        mo_form.product_qty = quantity
        mo = mo_form.save()
        mo.action_confirm()
        return mo

    def _produce(self, mo, quantity=0):
        produce_form = Form(self.env['mrp.product.produce'].with_user(self.user_mrp_manager).with_context({
            'active_id': mo.id,
            'active_ids': [mo.id],
        }))
        if quantity:
            produce_form.qty_producing = quantity
        product_produce = produce_form.save()
        product_produce.do_produce()


class TestMrpValuationStandard(TestMrpValuationCommon):
    def test_fifo_fifo_1(self):
        self.component.product_tmpl_id.categ_id.property_cost_method = 'fifo'
        self.product1.product_tmpl_id.categ_id.property_cost_method = 'fifo'

        self._make_in_move(self.component, 1, 10)
        self._make_in_move(self.component, 1, 20)
        mo = self._make_mo(self.bom, 2)
        self._produce(mo, 1)
        mo.post_inventory()
        self.assertEqual(self.component.value_svl, 20)
        self.assertEqual(self.product1.value_svl, 10)
        self.assertEqual(self.component.quantity_svl, 1)
        self.assertEqual(self.product1.quantity_svl, 1)
        self._produce(mo)
        mo.button_mark_done()
        self.assertEqual(self.component.value_svl, 0)
        self.assertEqual(self.product1.value_svl, 30)
        self.assertEqual(self.component.quantity_svl, 0)
        self.assertEqual(self.product1.quantity_svl, 2)

    def test_fifo_fifo_2(self):
        self.component.product_tmpl_id.categ_id.property_cost_method = 'fifo'
        self.product1.product_tmpl_id.categ_id.property_cost_method = 'fifo'

        self._make_in_move(self.component, 1, 10)
        self._make_in_move(self.component, 1, 20)
        mo = self._make_mo(self.bom, 2)
        self._produce(mo)
        mo.button_mark_done()
        self.assertEqual(self.component.value_svl, 0)
        self.assertEqual(self.product1.value_svl, 30)
        self.assertEqual(self.component.quantity_svl, 0)
        self.assertEqual(self.product1.quantity_svl, 2)
        self._make_out_move(self.product1, 1)
        self.assertEqual(self.product1.value_svl, 15)

    def test_fifo_avco_1(self):
        self.component.product_tmpl_id.categ_id.property_cost_method = 'fifo'
        self.product1.product_tmpl_id.categ_id.property_cost_method = 'average'

        self._make_in_move(self.component, 1, 10)
        self._make_in_move(self.component, 1, 20)
        mo = self._make_mo(self.bom, 2)
        self._produce(mo, 1)
        mo.post_inventory()
        self.assertEqual(self.component.value_svl, 20)
        self.assertEqual(self.product1.value_svl, 10)
        self.assertEqual(self.component.quantity_svl, 1)
        self.assertEqual(self.product1.quantity_svl, 1)
        self._produce(mo)
        mo.button_mark_done()
        self.assertEqual(self.component.value_svl, 0)
        self.assertEqual(self.product1.value_svl, 30)
        self.assertEqual(self.component.quantity_svl, 0)
        self.assertEqual(self.product1.quantity_svl, 2)

    def test_fifo_avco_2(self):
        self.component.product_tmpl_id.categ_id.property_cost_method = 'fifo'
        self.product1.product_tmpl_id.categ_id.property_cost_method = 'average'

        self._make_in_move(self.component, 1, 10)
        self._make_in_move(self.component, 1, 20)
        mo = self._make_mo(self.bom, 2)
        self._produce(mo)
        mo.button_mark_done()
        self.assertEqual(self.component.value_svl, 0)
        self.assertEqual(self.product1.value_svl, 30)
        self.assertEqual(self.component.quantity_svl, 0)
        self.assertEqual(self.product1.quantity_svl, 2)
        self._make_out_move(self.product1, 1)
        self.assertEqual(self.product1.value_svl, 15)

    def test_fifo_std_1(self):
        self.component.product_tmpl_id.categ_id.property_cost_method = 'fifo'
        self.product1.product_tmpl_id.categ_id.property_cost_method = 'standard'
        self.product1.standard_price = 8.8

        self._make_in_move(self.component, 1, 10)
        self._make_in_move(self.component, 1, 20)
        mo = self._make_mo(self.bom, 2)
        self._produce(mo, 1)
        mo.post_inventory()
        self.assertEqual(self.component.value_svl, 20)
        self.assertEqual(self.product1.value_svl, 8.8)
        self.assertEqual(self.component.quantity_svl, 1)
        self.assertEqual(self.product1.quantity_svl, 1)
        self._produce(mo)
        mo.button_mark_done()
        self.assertEqual(self.component.value_svl, 0)
        self.assertEqual(self.product1.value_svl, 8.8 * 2)
        self.assertEqual(self.component.quantity_svl, 0)
        self.assertEqual(self.product1.quantity_svl, 2)

    def test_fifo_std_2(self):
        self.component.product_tmpl_id.categ_id.property_cost_method = 'fifo'
        self.product1.product_tmpl_id.categ_id.property_cost_method = 'standard'
        self.product1.standard_price = 8.8

        self._make_in_move(self.component, 1, 10)
        self._make_in_move(self.component, 1, 20)
        mo = self._make_mo(self.bom, 2)
        self._produce(mo)
        mo.button_mark_done()
        self.assertEqual(self.component.value_svl, 0)
        self.assertEqual(self.product1.value_svl, 8.8 * 2)
        self.assertEqual(self.component.quantity_svl, 0)
        self.assertEqual(self.product1.quantity_svl, 2)
        self._make_out_move(self.product1, 1)
        self.assertEqual(self.product1.value_svl, 8.8)

    def test_std_avco_1(self):
        self.component.product_tmpl_id.categ_id.property_cost_method = 'standard'
        self.product1.product_tmpl_id.categ_id.property_cost_method = 'average'
        self.component.standard_price = 8.8

        self._make_in_move(self.component, 1)
        self._make_in_move(self.component, 1)
        mo = self._make_mo(self.bom, 2)
        self._produce(mo, 1)
        mo.post_inventory()
        self.assertEqual(self.component.value_svl, 8.8)
        self.assertEqual(self.product1.value_svl, 8.8)
        self.assertEqual(self.component.quantity_svl, 1)
        self.assertEqual(self.product1.quantity_svl, 1)
        self._produce(mo)
        mo.button_mark_done()
        self.assertEqual(self.component.value_svl, 0)
        self.assertEqual(self.product1.value_svl, 8.8 * 2)
        self.assertEqual(self.component.quantity_svl, 0)
        self.assertEqual(self.product1.quantity_svl, 2)

    def test_std_avco_2(self):
        self.component.product_tmpl_id.categ_id.property_cost_method = 'standard'
        self.product1.product_tmpl_id.categ_id.property_cost_method = 'average'
        self.component.standard_price = 8.8

        self._make_in_move(self.component, 1)
        self._make_in_move(self.component, 1)
        mo = self._make_mo(self.bom, 2)
        self._produce(mo)
        mo.button_mark_done()
        self.assertEqual(self.component.value_svl, 0)
        self.assertEqual(self.product1.value_svl, 8.8 * 2)
        self.assertEqual(self.component.quantity_svl, 0)
        self.assertEqual(self.product1.quantity_svl, 2)
        self._make_out_move(self.product1, 1)
        self.assertEqual(self.product1.value_svl, 8.8)

    def test_std_std_1(self):
        self.component.product_tmpl_id.categ_id.property_cost_method = 'standard'
        self.product1.product_tmpl_id.categ_id.property_cost_method = 'standard'
        self.component.standard_price = 8.8
        self.product1.standard_price = 7.2

        self._make_in_move(self.component, 1)
        self._make_in_move(self.component, 1)
        mo = self._make_mo(self.bom, 2)
        self._produce(mo, 1)
        mo.post_inventory()
        self.assertEqual(self.component.value_svl, 8.8)
        self.assertEqual(self.product1.value_svl, 7.2)
        self.assertEqual(self.component.quantity_svl, 1)
        self.assertEqual(self.product1.quantity_svl, 1)
        self._produce(mo)
        mo.button_mark_done()
        self.assertEqual(self.component.value_svl, 0)
        self.assertEqual(self.product1.value_svl, 7.2 * 2)
        self.assertEqual(self.component.quantity_svl, 0)
        self.assertEqual(self.product1.quantity_svl, 2)

    def test_std_std_2(self):
        self.component.product_tmpl_id.categ_id.property_cost_method = 'standard'
        self.product1.product_tmpl_id.categ_id.property_cost_method = 'standard'
        self.component.standard_price = 8.8
        self.product1.standard_price = 7.2

        self._make_in_move(self.component, 1)
        self._make_in_move(self.component, 1)
        mo = self._make_mo(self.bom, 2)
        self._produce(mo)
        mo.button_mark_done()
        self.assertEqual(self.component.value_svl, 0)
        self.assertEqual(self.product1.value_svl, 7.2 * 2)
        self.assertEqual(self.component.quantity_svl, 0)
        self.assertEqual(self.product1.quantity_svl, 2)
        self._make_out_move(self.product1, 1)
        self.assertEqual(self.product1.value_svl, 7.2)

    def test_avco_avco_1(self):
        self.component.product_tmpl_id.categ_id.property_cost_method = 'average'
        self.product1.product_tmpl_id.categ_id.property_cost_method = 'average'

        self._make_in_move(self.component, 1, 10)
        self._make_in_move(self.component, 1, 20)
        mo = self._make_mo(self.bom, 2)
        self._produce(mo, 1)
        mo.post_inventory()
        self.assertEqual(self.component.value_svl, 15)
        self.assertEqual(self.product1.value_svl, 15)
        self.assertEqual(self.component.quantity_svl, 1)
        self.assertEqual(self.product1.quantity_svl, 1)
        self._produce(mo)
        mo.button_mark_done()
        self.assertEqual(self.component.value_svl, 0)
        self.assertEqual(self.product1.value_svl, 30)
        self.assertEqual(self.component.quantity_svl, 0)
        self.assertEqual(self.product1.quantity_svl, 2)

    def test_avco_avco_2(self):
        self.component.product_tmpl_id.categ_id.property_cost_method = 'average'
        self.product1.product_tmpl_id.categ_id.property_cost_method = 'average'

        self._make_in_move(self.component, 1, 10)
        self._make_in_move(self.component, 1, 20)
        mo = self._make_mo(self.bom, 2)
        self._produce(mo)
        mo.button_mark_done()
        self.assertEqual(self.component.value_svl, 0)
        self.assertEqual(self.product1.value_svl, 30)
        self.assertEqual(self.component.quantity_svl, 0)
        self.assertEqual(self.product1.quantity_svl, 2)
        self._make_out_move(self.product1, 1)
        self.assertEqual(self.product1.value_svl, 15)
