# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.fields import Command
from odoo.tests import HttpCase, tagged

from odoo.addons.website_sale.tests.common import WebsiteSaleCommon


@tagged('post_install', '-at_install')
class TestUi(HttpCase, WebsiteSaleCommon):

    def test_01_free_delivery_when_exceed_threshold(self):
        if self.env['ir.module.module']._get('payment_custom').state != 'installed':
            self.skipTest("Transfer provider is not installed")

        transfer_provider = self.env.ref('payment.payment_provider_transfer')
        transfer_provider.write({
            'state': 'enabled',
            'is_published': True,
        })
        transfer_provider._transfer_ensure_pending_msg_is_set()

        # Avoid Shipping/Billing address page
        admin_partner = self.env.ref('base.partner_admin')
        admin_partner.write(self.dummy_partner_address_values)

        self.partner = admin_partner  # override default from WebsiteSaleCommon
        cart = self._create_so()

        self.free_delivery.write({
            'name': 'Delivery Now Free Over 10',
            'fixed_price': 2,
            'free_over': True,
            'amount': 10,
        })

        product_delivery_poste = self._prepare_carrier_product(
            name="The Poste", list_price=20.0,
        )
        self.carrier = self._prepare_carrier(
            product_delivery_poste,
            name='The Poste',
            sequence=9999,
            fixed_price=20.0,
            delivery_type='base_on_rule',
            price_rule_ids=[
                Command.create({
                    'max_value': 5,
                    'list_base_price': 20,
                }),
                Command.create({
                    'operator': '>=',
                    'max_value': 5,
                    'list_base_price': 50,
                }),
                Command.create({
                    'operator': '>=',
                    'max_value': 300,
                    'variable': 'price',
                    'list_base_price': 0,
                }),
            ],
        )

        self.start_tour("/", 'check_free_delivery', login="admin", session_data={
            'sale_order_id': cart.id,
        })
