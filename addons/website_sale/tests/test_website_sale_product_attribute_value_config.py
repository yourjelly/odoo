# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.sale.tests.test_sale_product_attribute_value_config import TestSaleProductAttributeValueSetup
from odoo.tests import tagged


@tagged('post_install', '-at_install')
class TestWebsiteSaleProductAttributeValueConfig(TestSaleProductAttributeValueSetup):

    def test_get_combination_info(self):
        current_website = self.env['website'].get_current_website()
        pricelist = current_website.get_current_pricelist()

        self.computer = self.computer.with_context(website_id=current_website.id)

        # make sure the pricelist has a 10% discount
        pricelist.item_ids = self.env['product.pricelist.item'].create({
            'price_discount': 10,
            'compute_price': 'formula',
        })

        discount_rate = 0.9

        # make sure there is a 15% tax on the product
        tax = self.env['account.tax'].create({'name': "Test tax", 'amount': 15})
        self.computer.taxes_id = tax
        tax_ratio = (100 + tax.amount) / 100

        currency_ratio = 2
        pricelist.currency_id = self._setup_currency(currency_ratio)

        # ensure pricelist is set to with_discount
        pricelist.discount_policy = 'with_discount'

        # CASE: B2B setting
        # DLE P171: Adding an inactive user to a group in order to test things is a bit weird.
        # When doing
        # self.env.ref('account.group_show_line_subtotals_tax_excluded').users |= self.env.user
        # You would expect self.env.user to be in self.env.ref('account.group_show_line_subtotals_tax_excluded').users
        # Actually in current master this is not the case, as self.env.user (admin) is inactive,
        # and the active_test=True will remove it automatically.
        # In the current branch, it will add the user in the many2many cache field even if the user is not active and active_test is enabled,
        # which in my sense is not entirely False because this is what the developer wanted here.
        # What is wrong is that when it removes it, it removes it for the cache with the current context (without active_test=False),
        # and self.env.user is therefore already not in the cache value of group_tax_included.users and there is a shortcut in that case to not change the cache:
        # if new_relation == old_relation:
        #     return records.browse()
        group_tax_included = self.env.ref('account.group_show_line_subtotals_tax_included').with_context(active_test=False)
        group_tax_excluded = self.env.ref('account.group_show_line_subtotals_tax_excluded').with_context(active_test=False)
        group_tax_included.users -= self.env.user
        group_tax_excluded.users |= self.env.user

        combination_info = self.computer._get_combination_info()
        self.assertEqual(combination_info['price'], 2222 * discount_rate * currency_ratio)
        self.assertEqual(combination_info['list_price'], 2222 * discount_rate * currency_ratio)
        self.assertEqual(combination_info['has_discounted_price'], False)

        # CASE: B2C setting
        group_tax_excluded.users -= self.env.user
        group_tax_included.users |= self.env.user

        combination_info = self.computer._get_combination_info()
        self.assertEqual(combination_info['price'], 2222 * discount_rate * currency_ratio * tax_ratio)
        self.assertEqual(combination_info['list_price'], 2222 * discount_rate * currency_ratio * tax_ratio)
        self.assertEqual(combination_info['has_discounted_price'], False)

        # CASE: pricelist 'without_discount'
        pricelist.discount_policy = 'without_discount'

        # ideally we would need to use compare_amounts everywhere, but this is
        # the only rounding where it fails without it
        combination_info = self.computer._get_combination_info()
        self.assertEqual(pricelist.currency_id.compare_amounts(combination_info['price'], 2222 * discount_rate * currency_ratio * tax_ratio), 0)
        self.assertEqual(pricelist.currency_id.compare_amounts(combination_info['list_price'], 2222 * currency_ratio * tax_ratio), 0)
        self.assertEqual(combination_info['has_discounted_price'], True)
