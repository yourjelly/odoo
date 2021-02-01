# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.sale.tests.test_sale_product_attribute_value_config import \
    TestSaleProductAttributeValueCommon


class TestGiftCardCommon(TestSaleProductAttributeValueCommon):

    @classmethod
    def setUpClass(cls):
        super(TestGiftCardCommon, cls).setUpClass()

        cls.partner = cls.env['res.partner'].create({
            'name': 'Ouss Mess',
            'email': 'ouss.mess@example.com',
        })

        cls.empty_order = cls.env['sale.order'].create({
            'partner_id': cls.partner.id
        })

        cls.uom_unit = cls.env.ref('uom.product_uom_unit')
