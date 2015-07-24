# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from openerp.tests import common

class TestPosOrder(common.TransactionCase):
    def setUp(self):
        super(TestPosOrder, self).setUp()

        pos_journal = self.env['account.journal'].create({'name': "test_pos_journal",
                                                          'code': "CODE",
                                                          'type': 'sale'})
        pos_config = self.env['pos.config'].create({'name': "test_pos_config",
                                                    'journal_id': pos_journal.id})
        pos_session = self.env['pos.session'].create({'config_id': pos_config.id}).id
        pos_order = self.env['pos.order'].create({'pricelist_id': 1,
                                                  'session_id': pos_session,
                                                  'name': "test_pos_order"})

        # <record id="attn_VAT-OUT-21-S" model="account.tax.template">
        #     <field name="sequence">10</field>
        #     <field name="description">VAT-OUT-21-S</field>
        #     <field name="name">VAT 21% - Services</field>
        #     <field name="refund_account_id" ref="a451054"/>
        #     <field name="account_id" ref="a451054"/>
        #     <field name="price_include" eval="0"/>
        #     <field name="amount">21</field>
        #     <field name="amount_type">percent</field>
        #     <field name="type_tax_use">sale</field>
        #     <field name="chart_template_id" ref="l10nbe_chart_template"/>
        #     <field name="tag_ids" eval="[(6,0,[ref('tax_tag_base_03')])]"/>
        # </record>
        pos_tax_21 = self.env['account.tax'].create({'name': "vat_21",
                                                     'type_tax_use': 'sale',
                                                     'amount_type': 'percent',
                                                     'amount': 21})
    def tearDown(self):
        test_orders = self.env['pos.order'].search([('name', 'like', 'test_pos_config')])

        for order in test_orders:
            order.unlink()

        for session in self.env['pos.session'].search([]):
            session.unlink()

        for config in self.env['pos.config'].search([('name', '=', 'test_pos_config')]):
            config.unlink()

        for journal in self.env['account.journal'].search([('name', '=', 'test_pos_journal')]):
            journal.unlink()

        for order_line in self.env['pos.order.line'].search([]):
            order_line.unlink()

        for tax in self.env['account.tax'].search([]):
            tax.unlink()

        super(TestPosOrder, self).tearDown()

    def test_existence_of_calculate_hash(self):
        pos_order = self.env['pos.order'].search([('name', 'like', 'test_pos_config')])

        self.assertTrue(callable(getattr(pos_order, 'calculate_hash', None)))

    def test_empty_calculate_hash(self):
        pos_order = self.env['pos.order'].search([('name', 'like', 'test_pos_config')])

        self.assertEqual(pos_order.calculate_hash(), "da39a3ee5e6b4b0d3255bfef95601890afd80709")

    def _create_pos_order_line(self, product_xml_id, qty):
        ir_model_data = self.env['ir.model.data']
        product = ir_model_data.xmlid_to_object(product_xml_id)
        pos_order_line = self.env['pos.order.line'].create({'qty': qty,
                                                            'name': product.name,
                                                            'price_unit': product.list_price,
                                                            'product_id': product.id})
        return pos_order_line

    # p12
    def test_calculate_hash_example_1(self):
        pos_order = self.env['pos.order'].search([('name', 'like', 'test_pos_config')])

        order_lines = []

        order_lines.append(self._create_pos_order_line('pos_registered_cash_system_be.product_soda_light', 3))
        order_lines.append(self._create_pos_order_line('pos_registered_cash_system_be.product_spaghetti', 2))

        # todo jov
        # the salad in the example isn't great, because for 0.527 to
        # cost 8.53 price needs to be 16.186 which requires changing
        # of precision. So just set the price_subtotal manually.
        salad = self._create_pos_order_line('pos_registered_cash_system_be.product_salad', 0.527)
        order_lines.append(salad)

        order_lines.append(self._create_pos_order_line('pos_registered_cash_system_be.product_steak', 1))
        order_lines.append(self._create_pos_order_line('pos_registered_cash_system_be.product_coffee', 2))
        order_lines.append(self._create_pos_order_line('pos_registered_cash_system_be.product_dame_blanche', 1))
        order_lines.append(self._create_pos_order_line('pos_registered_cash_system_be.product_soda_light', -1))
        order_lines.append(self._create_pos_order_line('pos_registered_cash_system_be.product_wine', 1.25))

        pos_order.write({'lines': [(4, line.id) for line in order_lines]})

        self.assertEqual(pos_order.calculate_hash(), "bd532992502a62c40a741ec76423198d88d5a4f3")
