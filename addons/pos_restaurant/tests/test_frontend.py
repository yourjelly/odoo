# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import odoo.tests
from odoo.addons.account.tests.common import AccountTestInvoicingCommon


@odoo.tests.tagged('post_install', '-at_install')
class TestFrontend(AccountTestInvoicingCommon, odoo.tests.HttpCase):

    @classmethod
    def setUpClass(cls, chart_template_ref=None):
        super().setUpClass(chart_template_ref=chart_template_ref)

        cls.env = cls.env(user=cls.env.ref('base.user_admin'))
        account_obj = cls.env['account.account']

        account_receivable = account_obj.create({'code': 'X1012',
                                                 'name': 'Account Receivable - Test',
                                                 'account_type': 'asset_receivable',
                                                 'reconcile': True})

<<<<<<< HEAD
        drinks_category = self.env['pos.category'].create({'name': 'Drinks'})

        printer = self.env['restaurant.printer'].create({
||||||| parent of 7c08ab9d16ad (temp)
        printer = self.env['restaurant.printer'].create({
=======
        printer = cls.env['restaurant.printer'].create({
>>>>>>> 7c08ab9d16ad (temp)
            'name': 'Kitchen Printer',
            'proxy_ip': 'localhost',
            'product_categories_ids': [drinks_category.id]
        })
<<<<<<< HEAD
||||||| parent of 7c08ab9d16ad (temp)
        drinks_category = self.env['pos.category'].create({'name': 'Drinks'})
=======
        drinks_category = cls.env['pos.category'].create({'name': 'Drinks'})
>>>>>>> 7c08ab9d16ad (temp)

        main_company = cls.env.ref('base.main_company')

        second_cash_journal = cls.env['account.journal'].create({
            'name': 'Cash 2',
            'type': 'cash',
            'company_id': main_company.id
            })

        cls.env['pos.payment.method'].create({
            'name': 'Cash 2',
            'split_transactions': False,
            'receivable_account_id': account_receivable.id,
            'journal_id': second_cash_journal.id,
        })

        pos_config = cls.env['pos.config'].create({
            'name': 'Bar',
            'module_pos_restaurant': True,
            'is_table_management': True,
            'iface_splitbill': True,
            'iface_printbill': True,
            'iface_orderline_notes': True,
            'printer_ids': [(4, printer.id)],
            'iface_start_categ_id': drinks_category.id,
            'start_category': True,
<<<<<<< HEAD
||||||| parent of 7c08ab9d16ad (temp)
            'pricelist_id': self.env.ref('product.list0').id,
=======
            'pricelist_id': cls.env.ref('product.list0').id,
>>>>>>> 7c08ab9d16ad (temp)
        })

        main_floor = cls.env['restaurant.floor'].create({
            'name': 'Main Floor',
            'pos_config_ids': [(4, pos_config.id)],
        })

<<<<<<< HEAD
        table_05 = self.env['restaurant.table'].create({
            'name': '5',
||||||| parent of 7c08ab9d16ad (temp)
        table_05 = self.env['restaurant.table'].create({
            'name': 'T5',
=======
        cls.env['restaurant.table'].create({
            'name': 'T5',
>>>>>>> 7c08ab9d16ad (temp)
            'floor_id': main_floor.id,
            'seats': 4,
            'position_h': 100,
            'position_v': 100,
        })
<<<<<<< HEAD
        table_04 = self.env['restaurant.table'].create({
            'name': '4',
||||||| parent of 7c08ab9d16ad (temp)
        table_04 = self.env['restaurant.table'].create({
            'name': 'T4',
=======
        cls.env['restaurant.table'].create({
            'name': 'T4',
>>>>>>> 7c08ab9d16ad (temp)
            'floor_id': main_floor.id,
            'seats': 4,
            'shape': 'square',
            'position_h': 150,
            'position_v': 100,
        })
<<<<<<< HEAD
        table_02 = self.env['restaurant.table'].create({
            'name': '2',
||||||| parent of 7c08ab9d16ad (temp)
        table_02 = self.env['restaurant.table'].create({
            'name': 'T2',
=======
        cls.env['restaurant.table'].create({
            'name': 'T2',
>>>>>>> 7c08ab9d16ad (temp)
            'floor_id': main_floor.id,
            'seats': 4,
            'position_h': 250,
            'position_v': 100,
        })

        second_floor = cls.env['restaurant.floor'].create({
            'name': 'Second Floor',
            'pos_config_ids': [(4, pos_config.id)],
        })

<<<<<<< HEAD
        table_01 = self.env['restaurant.table'].create({
            'name': '1',
||||||| parent of 7c08ab9d16ad (temp)
        table_01 = self.env['restaurant.table'].create({
            'name': 'T1',
=======
        cls.env['restaurant.table'].create({
            'name': 'T1',
>>>>>>> 7c08ab9d16ad (temp)
            'floor_id': second_floor.id,
            'seats': 4,
            'shape': 'square',
            'position_h': 100,
            'position_v': 150,
        })
<<<<<<< HEAD
        table_03 = self.env['restaurant.table'].create({
            'name': '3',
||||||| parent of 7c08ab9d16ad (temp)
        table_03 = self.env['restaurant.table'].create({
            'name': 'T3',
=======
        cls.env['restaurant.table'].create({
            'name': 'T3',
>>>>>>> 7c08ab9d16ad (temp)
            'floor_id': second_floor.id,
            'seats': 4,
            'position_h': 100,
            'position_v': 250,
        })

        cls.env['ir.property']._set_default(
            'property_account_receivable_id',
            'res.partner',
            account_receivable,
            main_company,
        )

        test_sale_journal = cls.env['account.journal'].create({
            'name': 'Sales Journal - Test',
            'code': 'TSJ',
            'type': 'sale',
            'company_id': main_company.id
            })

        cash_journal = cls.env['account.journal'].create({
            'name': 'Cash Test',
            'code': 'TCJ',
            'type': 'cash',
            'company_id': main_company.id
            })

        pos_config.write({
            'journal_id': test_sale_journal.id,
            'invoice_journal_id': test_sale_journal.id,
            'payment_method_ids': [(0, 0, {
                'name': 'Cash',
                'split_transactions': False,
                'receivable_account_id': account_receivable.id,
                'journal_id': cash_journal.id,
            })],
        })

        cls.env['product.product'].create({
            'available_in_pos': True,
            'list_price': 2.20,
            'name': 'Coca-Cola',
            'weight': 0.01,
            'pos_categ_id': drinks_category.id,
            'categ_id': cls.env.ref('point_of_sale.product_category_pos').id,
            'taxes_id': [(6, 0, [])],
        })

        cls.env['product.product'].create({
            'available_in_pos': True,
            'list_price': 2.20,
            'name': 'Water',
            'weight': 0.01,
            'pos_categ_id': drinks_category.id,
            'categ_id': cls.env.ref('point_of_sale.product_category_pos').id,
            'taxes_id': [(6, 0, [])],
        })

        cls.env['product.product'].create({
            'available_in_pos': True,
            'list_price': 2.20,
            'name': 'Minute Maid',
            'weight': 0.01,
            'pos_categ_id': drinks_category.id,
            'categ_id': cls.env.ref('point_of_sale.product_category_pos').id,
            'taxes_id': [(6, 0, [])],
        })

        pricelist = cls.env['product.pricelist'].create({'name': 'Restaurant Pricelist'})
        pos_config.write({'pricelist_id': pricelist.id})

        cls.pos_config = pos_config

    def test_01_pos_restaurant(self):

        self.pos_config.with_user(self.env.ref('base.user_admin')).open_ui()

        self.start_tour("/pos/ui?config_id=%d" % self.pos_config.id, 'pos_restaurant_sync', login="admin")

        self.assertEqual(1, self.env['pos.order'].search_count([('amount_total', '=', 4.4), ('state', '=', 'draft')]))
        self.assertEqual(1, self.env['pos.order'].search_count([('amount_total', '=', 4.4), ('state', '=', 'paid')]))

        self.start_tour("/pos/ui?config_id=%d" % self.pos_config.id, 'pos_restaurant_sync_second_login', login="admin")

        self.assertEqual(0, self.env['pos.order'].search_count([('amount_total', '=', 4.4), ('state', '=', 'draft')]))
        self.assertEqual(1, self.env['pos.order'].search_count([('amount_total', '=', 2.2), ('state', '=', 'draft')]))
        self.assertEqual(2, self.env['pos.order'].search_count([('amount_total', '=', 4.4), ('state', '=', 'paid')]))

    def test_02_others(self):
        self.pos_config.with_user(self.env.ref('base.user_admin')).open_ui()
        self.start_tour("/pos/ui?config_id=%d" % self.pos_config.id, 'SplitBillScreenTour', login="admin")
        self.start_tour("/pos/ui?config_id=%d" % self.pos_config.id, 'ControlButtonsTour', login="admin")
        self.start_tour("/pos/ui?config_id=%d" % self.pos_config.id, 'FloorScreenTour', login="admin")

    def test_04_ticket_screen(self):
        self.pos_config.with_user(self.env.ref('base.user_admin')).open_ui()
        self.start_tour("/pos/ui?config_id=%d" % self.pos_config.id, 'PosResTicketScreenTour', login="admin")

    def test_05_tip_screen(self):
        self.pos_config.write({'set_tip_after_payment': True, 'iface_tipproduct': True, 'tip_product_id': self.env.ref('point_of_sale.product_product_tip')})
        self.pos_config.with_user(self.env.ref('base.user_admin')).open_ui()
        self.start_tour("/pos/ui?config_id=%d" % self.pos_config.id, 'PosResTipScreenTour', login="admin")

        order1 = self.env['pos.order'].search([('pos_reference', 'ilike', '%-0001')])
        order2 = self.env['pos.order'].search([('pos_reference', 'ilike', '%-0002')])
        order3 = self.env['pos.order'].search([('pos_reference', 'ilike', '%-0003')])
        order4 = self.env['pos.order'].search([('pos_reference', 'ilike', '%-0004')])
        order5 = self.env['pos.order'].search([('pos_reference', 'ilike', '%-0005')])

        self.assertTrue(order1.is_tipped and order1.tip_amount == 0.40)
        self.assertTrue(order2.is_tipped and order2.tip_amount == 1.00)
        self.assertTrue(order3.is_tipped and order3.tip_amount == 1.50)
        self.assertTrue(order4.is_tipped and order4.tip_amount == 1.00)
        self.assertTrue(order5.is_tipped and order5.tip_amount == 0.00)

    def test_06_split_bill_screen(self):
        self.pos_config.with_user(self.env.ref('base.user_admin')).open_ui()
        self.start_tour("/pos/ui?config_id=%d" % self.pos_config.id, 'SplitBillScreenTour2', login="admin")

    def test_07_refund_stay_current_table(self):
        self.pos_config.with_user(self.env.ref('base.user_admin')).open_ui()
        self.start_tour("/pos/ui?config_id=%d" % self.pos_config.id, 'RefundStayCurrentTableTour', login="admin")
