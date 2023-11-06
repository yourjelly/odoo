# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import odoo.tests

from odoo import Command
from odoo.addons.point_of_sale.tests.common import archive_products
from odoo.addons.point_of_sale.tests.common_setup_methods import setup_pos_combo_items


@odoo.tests.tagged("post_install", "-at_install")
class SelfOrderCommonTest(odoo.tests.HttpCase):
    browser_size = "375x667"
    touch_enabled = True

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        archive_products(cls.env)
        cls.pos_user = cls.env['res.users'].create({
            'name': 'POS User',
            'login': 'pos_user',
            'password': 'pos_user',
            'groups_id': [
                (4, cls.env.ref('base.group_user').id),
                (4, cls.env.ref('point_of_sale.group_pos_user').id),
            ],
        })
        cls.pos_admin = cls.env['res.users'].create({
            'name': 'POS Admin',
            'login': 'pos_admin',
            'password': 'pos_admin',
            'groups_id': [
                (4, cls.env.ref('base.group_user').id),
                (4, cls.env.ref('point_of_sale.group_pos_manager').id),
            ],
        })

        cls.cola = cls.env['product.product'].create({
            'name': 'Coca-Cola',
            'type': 'product',
            'list_price': 2.2,
            'taxes_id': False,
            'available_in_pos': True,
        })
        cls.fanta = cls.env['product.product'].create({
            'name': 'Fanta',
            'type': 'product',
            'list_price': 2.2,
            'taxes_id': False,
            'available_in_pos': True,
        })

        #desk organizer
        cls.desk_organizer = cls.env['product.product'].create({
            'name': 'Desk Organizer',
            'available_in_pos': True,
        })
        desk_size_attribute = cls.env['product.attribute'].create({
            'name': 'Size',
            'display_type': 'radio',
            'create_variant': 'no_variant',
        })
        desk_size_s = cls.env['product.attribute.value'].create({
            'name': 'S',
            'attribute_id': desk_size_attribute.id,
        })
        desk_size_m = cls.env['product.attribute.value'].create({
            'name': 'M',
            'attribute_id': desk_size_attribute.id,
        })
        desk_size_l = cls.env['product.attribute.value'].create({
            'name': 'L',
            'attribute_id': desk_size_attribute.id,
        })
        cls.env['product.template.attribute.line'].create({
            'product_tmpl_id': cls.desk_organizer.product_tmpl_id.id,
            'attribute_id': desk_size_attribute.id,
            'value_ids': [(6, 0, [desk_size_s.id, desk_size_m.id, desk_size_l.id])]
        })
        desk_fabrics_attribute = cls.env['product.attribute'].create({
            'name': 'Fabric',
            'display_type': 'select',
            'create_variant': 'no_variant',
        })
        desk_fabrics_leather = cls.env['product.attribute.value'].create({
            'name': 'Leather',
            'attribute_id': desk_fabrics_attribute.id,
        })
        desk_fabrics_other = cls.env['product.attribute.value'].create({
            'name': 'Custom',
            'attribute_id': desk_fabrics_attribute.id,
            'is_custom': True,
        })
        cls.env['product.template.attribute.line'].create({
            'product_tmpl_id': cls.desk_organizer.product_tmpl_id.id,
            'attribute_id': desk_fabrics_attribute.id,
            'value_ids': [(6, 0, [desk_fabrics_leather.id, desk_fabrics_other.id])]
        })

        cls.office_combo = setup_pos_combo_items(cls)

    def _add_tax_to_product_from_different_company(self):
        new_company = self.env['res.company'].create({
            'name': 'Test Company',
            'currency_id': self.env.ref('base.USD').id,
            'country_id': self.env.ref('base.us').id,
        })

        self.other_company_tax = (
            self.env["account.tax"]
            .with_company(new_company)
            .create(
                {
                    "name": "Tax that should not be used",
                    "amount": 50,
                    "amount_type": "percent",
                    "tax_group_id": self.env["account.tax.group"]
                    .with_company(new_company)
                    .create(
                        {
                            "name": "Tax Group that should not be used",
                        }
                    )
                    .id,
                    "company_id": new_company.id,
                }
            )
        )

        self.env['product.product'].search([]).with_company(new_company).write({
            'taxes_id': [Command.link(id) for id in self.other_company_tax.ids],
        })

    def setUp(self):
        super().setUp()
        self.pos_config = self.env["pos.config"].create(
            {
                "name": "BarTest",
                "self_ordering_default_user_id": self.pos_user.id,
                "module_pos_restaurant": True,
                "self_ordering_mode": "consultation",
                "floor_ids": self.env["restaurant.floor"].search([]),
            }
        )

        self.default_tax15 = self.env["account.tax"].create(
            {
                "name": "Default Tax for Self Order",
                "amount": 15,
                "amount_type": "percent",
            }
        )

        # we need a default tax fixed at 15% to all product because in the test prices are based on this tax.
        # some time with the localization this may not be the case. So we force it.
        self.env["product.product"].search([]).taxes_id = self.default_tax15

        # A new tax is added to each product and this tax is from a different company.
        # This is important in the test because the added tax should not be used in the tour.
        self._add_tax_to_product_from_different_company()
