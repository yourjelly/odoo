# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo.addons.account.tests.common import AccountTestInvoicingCommon
from odoo.tests import tagged
from odoo.tests import Form


@tagged('post_install', '-at_install')
class TestOnchangeProductId(AccountTestInvoicingCommon):

    def test_fiscal_position_mapping_tax_incl_to_tax_excl(self):
        tax_price_include = self.env['account.tax'].create({
            'name': 'tax_include',
            'amount': 21.0,
            'price_include': True,
            'type_tax_use': 'sale',
        })
        tax_price_exclude = self.env['account.tax'].create({
            'name': 'tax_include',
            'amount': 10.0,
            'type_tax_use': 'sale',
        })

        product = self.env['product.product'].create({
            'name': 'product',
            'list_price': 121.0,
            'taxes_id': [(6, 0, tax_price_include.ids)],
        })

        fiscal_position = self.env['account.fiscal.position'].create({
            'name': 'fiscal_position',
            'tax_ids': [
                (0, None, {
                    'tax_src_id': tax_price_include.id,
                    'tax_dest_id': tax_price_exclude.id,
                }),
            ],
        })

        # Create the SO with one SO line and apply a pricelist and fiscal position on it
        order_form = Form(self.env['sale.order'].with_context(tracking_disable=True))
        order_form.partner_id = self.partner_a
        order_form.fiscal_position_id = fiscal_position
        with order_form.order_line.new() as line:
            line.product_id = product
        sale_order = order_form.save()

        # Check the unit price of SO line
        self.assertEqual(100, sale_order.order_line.price_unit, "The included tax must be subtracted to the price")

    def test_pricelist_application(self):
        """ Test different prices are correctly applied based on dates """
        support_product = self.env['product.product'].create({
            'name': 'Virtual Home Staging',
            'list_price': 100,
        })
        partner = self.env['res.partner'].create(dict(name="George"))

        christmas_pricelist = self.env['product.pricelist'].create({
            'name': 'Christmas pricelist',
            'item_ids': [(0, 0, {
                'date_start': "2017-12-01",
                'date_end': "2017-12-24",
                'compute_price': 'percentage',
                'base': 'list_price',
                'percent_price': 20,
                'applied_on': '3_global',
                'name': 'Pre-Christmas discount'
            }), (0, 0, {
                'date_start': "2017-12-25",
                'date_end': "2017-12-31",
                'compute_price': 'percentage',
                'base': 'list_price',
                'percent_price': 50,
                'applied_on': '3_global',
                'name': 'Post-Christmas super-discount'
            })]
        })

        # Create the SO with pricelist based on date
        order_form = Form(self.env['sale.order'].with_context(tracking_disable=True))
        order_form.partner_id = partner
        order_form.date_order = '2017-12-20'
        order_form.pricelist_id = christmas_pricelist
        with order_form.order_line.new() as line:
            line.product_id = support_product
        so = order_form.save()
        # Check the unit price and subtotal of SO line
        self.assertEqual(so.order_line[0].price_unit, 80, "First date pricelist rule not applied")
        self.assertEqual(so.order_line[0].price_subtotal, so.order_line[0].price_unit * so.order_line[0].product_uom_qty, 'Total of SO line should be a multiplication of unit price and ordered quantity')

        # Change order date of the SO and check the unit price and subtotal of SO line
        with Form(so) as order:
            order.date_order = '2017-12-30'
            with order.order_line.edit(0) as line:
                line.product_id = support_product

        self.assertEqual(so.order_line[0].price_unit, 50, "Second date pricelist rule not applied")
        self.assertEqual(so.order_line[0].price_subtotal, so.order_line[0].price_unit * so.order_line[0].product_uom_qty, 'Total of SO line should be a multiplication of unit price and ordered quantity')

    def test_pricelist_uom_discount(self):
        """ Test prices and discounts are correctly applied based on date and uom"""
        computer_case = self.env['product.product'].create({
            'name': 'Drawer Black',
            'list_price': 100,
        })
        partner = self.env['res.partner'].create(dict(name="George"))
        categ_unit_id = self.ref('uom.product_uom_categ_unit')
        goup_discount_id = self.ref('product.group_discount_per_so_line')
        self.env.user.write({'groups_id': [(4, goup_discount_id, 0)]})
        new_uom = self.env['uom.uom'].create({
            'name': '10 units',
            'factor_inv': 10,
            'uom_type': 'bigger',
            'rounding': 1.0,
            'category_id': categ_unit_id
        })
        christmas_pricelist = self.env['product.pricelist'].create({
            'name': 'Christmas pricelist',
            'discount_policy': 'without_discount',
            'item_ids': [(0, 0, {
                'date_start': "2017-12-01",
                'date_end': "2017-12-30",
                'compute_price': 'percentage',
                'base': 'list_price',
                'percent_price': 10,
                'applied_on': '3_global',
                'name': 'Christmas discount'
            })]
        })

        so = self.env['sale.order'].create({
            'partner_id': partner.id,
            'date_order': '2017-12-20',
            'pricelist_id': christmas_pricelist.id,
        })

        order_line = self.env['sale.order.line'].new({
            'order_id': so.id,
            'product_id': computer_case.id,
        })

        # force compute uom and prices
        order_line.product_id_change()
        order_line.product_uom_change()
        order_line._onchange_discount()
        self.assertEqual(order_line.price_subtotal, 90, "Christmas discount pricelist rule not applied")
        self.assertEqual(order_line.discount, 10, "Christmas discount not equalt to 10%")
        order_line.product_uom = new_uom
        order_line.product_uom_change()
        order_line._onchange_discount()
        self.assertEqual(order_line.price_subtotal, 900, "Christmas discount pricelist rule not applied")
        self.assertEqual(order_line.discount, 10, "Christmas discount not equalt to 10%")

    def test_pricelist_based_on_other(self):
        """ Test price and discount are correctly applied with a pricelist based on an other one"""
        computer_case = self.env['product.product'].create({
            'name': 'Drawer Black',
            'list_price': 100,
        })
        partner = self.env['res.partner'].create(dict(name="George"))
        goup_discount_id = self.ref('product.group_discount_per_so_line')
        self.env.user.write({'groups_id': [(4, goup_discount_id, 0)]})

        first_pricelist = self.env['product.pricelist'].create({
            'name': 'First pricelist',
            'discount_policy': 'without_discount',
            'item_ids': [(0, 0, {
                'compute_price': 'percentage',
                'base': 'list_price',
                'percent_price': 10,
                'applied_on': '3_global',
                'name': 'First discount'
            })]
        })

        second_pricelist = self.env['product.pricelist'].create({
            'name': 'Second pricelist',
            'discount_policy': 'without_discount',
            'item_ids': [(0, 0, {
                'compute_price': 'formula',
                'base': 'pricelist',
                'base_pricelist_id': first_pricelist.id,
                'price_discount': 10,
                'applied_on': '3_global',
                'name': 'Second discount'
            })]
        })

        so = self.env['sale.order'].create({
            'partner_id': partner.id,
            'date_order': '2018-07-11',
            'pricelist_id': second_pricelist.id,
        })

        order_line = self.env['sale.order.line'].new({
            'order_id': so.id,
            'product_id': computer_case.id,
        })

        # force compute uom and prices
        order_line.product_id_change()
        order_line._onchange_discount()
        self.assertEqual(order_line.price_subtotal, 81, "Second pricelist rule not applied")
        self.assertEqual(order_line.discount, 19, "Second discount not applied")

    def test_pricelist_with_other_currency(self):
        """ Test prices are correctly applied with a pricelist with an other currency"""
        computer_case = self.env['product.product'].create({
            'name': 'Drawer Black',
            'list_price': 100,
        })
        computer_case.list_price = 100
        partner = self.env['res.partner'].create(dict(name="George"))
        categ_unit_id = self.ref('uom.product_uom_categ_unit')
        other_currency = self.env['res.currency'].create({'name': 'other currency',
            'symbol': 'other'})
        self.env['res.currency.rate'].create({'name': '2018-07-11',
            'rate': 2.0,
            'currency_id': other_currency.id,
            'company_id': self.env.company.id})
        self.env['res.currency.rate'].search(
            [('currency_id', '=', self.env.company.currency_id.id)]
        ).unlink()
        new_uom = self.env['uom.uom'].create({
            'name': '10 units',
            'factor_inv': 10,
            'uom_type': 'bigger',
            'rounding': 1.0,
            'category_id': categ_unit_id
        })

        # This pricelist doesn't show the discount
        first_pricelist = self.env['product.pricelist'].create({
            'name': 'First pricelist',
            'currency_id': other_currency.id,
            'discount_policy': 'with_discount',
            'item_ids': [(0, 0, {
                'compute_price': 'percentage',
                'base': 'list_price',
                'percent_price': 10,
                'applied_on': '3_global',
                'name': 'First discount'
            })]
        })

        so = self.env['sale.order'].create({
            'partner_id': partner.id,
            'date_order': '2018-07-12',
            'pricelist_id': first_pricelist.id,
        })

        order_line = self.env['sale.order.line'].new({
            'order_id': so.id,
            'product_id': computer_case.id,
        })

        # force compute uom and prices
        order_line.product_id_change()
        self.assertEqual(order_line.price_unit, 180, "First pricelist rule not applied")
        order_line.product_uom = new_uom
        order_line.product_uom_change()
        self.assertEqual(order_line.price_unit, 1800, "First pricelist rule not applied")
