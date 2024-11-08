# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.fields import Command

from odoo.addons.delivery.tests.common import DeliveryCommon
from odoo.addons.payment_custom.tests.common import PaymentCustomCommon
from odoo.addons.website_sale_stock.tests.test_website_sale_stock_product_warehouse import \
    TestWebsiteSaleStockProductWarehouse


class InStoreCommon(PaymentCustomCommon, TestWebsiteSaleStockProductWarehouse, DeliveryCommon):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        # Create in-store delivery method.
        cls.dm_product = cls._prepare_carrier_product(list_price=0.0)
        cls.provider = cls._prepare_provider('on_site')
        cls.in_store_dm = cls._prepare_carrier(
            cls.dm_product,
            fixed_price=0.0,
            delivery_type='in_store',
            warehouse_ids=[Command.set([cls.warehouse_1.id])],
            name="Example in-store delivery",
            is_published=True,
        )

    def _create_so_in_store_dm(self, **values):
        default_values = {
            'partner_id': self.partner.id,
            'website_id': self.website.id,
            'order_line': [Command.create({
                'product_id': self.product_A.id,
                'product_uom_qty': 5.0,
            })],
            'carrier_id': self.in_store_dm.id,
        }
        return self.env['sale.order'].create(dict(default_values, **values))
