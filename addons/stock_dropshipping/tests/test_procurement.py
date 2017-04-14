# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

# from odoo.addons.sale.tests.test_sale_common import TestSale
# from odoo.exceptions import UserError
from odoo.tests import common
# from common import TestStock
# import pdb


class TestProcurement(common.TransactionCase):

    def setUp(self):
        super(TestProcurement, self).setUp()

        self.Product = self.env['product.product']
        self.categ_name = self.env.ref('product.product_category_1')

        def test_procurement(self):
            product_with_no_seller = self.Product.create({
            'name': 'product with no seller',
            'list_price': 20.0,
            'standard_price': 15.00,
            'categ_id': self.categ_name.id})

            print product_with_no_seller
