# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import datetime

from odoo.tests import tagged

from odoo.addons.sale.tests.common import SaleCommon


@tagged('post_install', '-at_install')
class TestSaleProductTemplate(SaleCommon):

    def test_sale_get_configurator_display_price(self):
        """ Test the `_get_configurator_display_price` method. """
        configurator_price = self.env['product.template']._get_configurator_display_price(
            product_or_template=self._create_product(list_price=40),
            quantity=3,
            date=datetime(2000, 1, 1),
            currency=self.currency,
            pricelist=self.pricelist,
        )

        self.assertEqual(configurator_price, 40)

    def test_sale_get_additional_configurator_data(self):
        """ Test the `_get_additional_configurator_data` method. """
        configurator_data = self.env['product.template']._get_additional_configurator_data(
            product_or_template=self.product,
            date=datetime(2000, 1, 1),
            currency=self.currency,
            pricelist=self.pricelist,
        )

        self.assertEqual(configurator_data, {})
