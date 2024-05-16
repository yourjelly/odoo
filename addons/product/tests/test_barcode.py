# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.exceptions import ValidationError
from odoo.fields import Command
from odoo.tests import TransactionCase, tagged


@tagged('post_install', '-at_install')
class TestProductBarcode(TransactionCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.category = cls.env['product.category'].create({'name': 'Category'})
        cls.env['product.product'].create([{
            'name': 'BC1',
            'barcode': '1',
            'categ_id': cls.category.id,
        }, {
            'name': 'BC2',
            'barcode': '2',
            'categ_id': cls.category.id,
        },
        ])

        cls.size_attribute = cls.env['product.attribute'].create({
            'name': 'Size',
            'value_ids': [
                Command.create({'name': 'SMALL'}),
                Command.create({'name': 'LARGE'}),
            ]
        })
        cls.size_attribute_s, cls.size_attribute_l = cls.size_attribute.value_ids

        cls.template = cls.env['product.template'].create({
            'name': 'template',
            'categ_id': cls.category.id,
            })
        cls.template.write({
            'attribute_line_ids': [Command.create({
                'attribute_id': cls.size_attribute.id,
                'value_ids': [
                    Command.link(cls.size_attribute_s.id),
                    Command.link(cls.size_attribute_l.id),
                ],
            })]
        })

    def test_blank_barcodes_allowed(self):
        """Makes sure duplicated blank barcodes are allowed."""
        for i in range(2):
            self.env['product.product'].create({
                'name': f'BC_{i}',
                'categ_id': self.category.id,
            })

    def test_false_barcodes_allowed(self):
        """Makes sure duplicated False barcodes are allowed."""
        for i in range(2):
            self.env['product.product'].create({
                'name': f'BC_{i}',
                'barcode': False,
                'categ_id': self.category.id,
            })

    def test_duplicated_barcode(self):
        """Tests for simple duplication."""
        with self.assertRaises(ValidationError):
            self.env['product.product'].create({
                'name': 'BC3',
                'barcode': '1',
                'categ_id': self.category.id,
            })

    def test_duplicated_barcode_in_batch_edit(self):
        """Tests for duplication in batch edits."""
        batch = [
            {'name': 'BC3', 'barcode': '3', 'categ_id': self.category.id},
            {'name': 'BC4', 'barcode': '4', 'categ_id': self.category.id},
        ]
        self.env['product.product'].create(batch)
        batch.append({'name': 'BC5', 'barcode': '1', 'categ_id': self.category.id})
        with self.assertRaises(ValidationError):
            self.env['product.product'].create(batch)

    def test_test_duplicated_barcode_error_msg_content(self):
        """Validates the error message shown when duplicated barcodes are found."""
        batch = [
            {'name': 'BC3', 'barcode': '3', 'categ_id': self.category.id},
            {'name': 'BC4', 'barcode': '3', 'categ_id': self.category.id},
            {'name': 'BC5', 'barcode': '4', 'categ_id': self.category.id},
            {'name': 'BC6', 'barcode': '4', 'categ_id': self.category.id},
            {'name': 'BC7', 'barcode': '1', 'categ_id': self.category.id},
        ]
        try:
            self.env['product.product'].create(batch)
        except ValidationError as exc:
            assert 'Barcode "3" already assigned to product(s): BC3, BC4' in exc.args[0]
            assert 'Barcode "4" already assigned to product(s): BC5, BC6' in exc.args[0]
            assert 'Barcode "1" already assigned to product(s): BC1' in exc.args[0]

    def test_delete_package_and_use_its_barcode_in_product(self):
        """ Test that the barcode of the package can be used when the package is removed from the product."""
        product = self.env['product.product'].create({
            'name': 'product',
            'categ_id': self.category.id,
            'packaging_ids': [(0, 0, {
                'name': 'packing',
                'barcode': '1234',
            })]
        })
        package = product.packaging_ids
        self.assertTrue(package.exists())
        self.assertEqual(package.barcode, '1234')
        product.packaging_ids = False
        self.assertFalse(package.exists())
        product.barcode = '1234'

    def test_duplicated_barcodes_are_allowed_for_different_companies(self):
        """Barcode needs to be unique only withing the same company"""
        company_a = self.env.company
        company_b = self.env['res.company'].create({'name': 'CB'})

        allowed_products = [
            # Allowed, barcode doesn't exist yet
            {'name': 'A1', 'barcode': '3', 'company_id': company_a.id, 'categ_id': self.category.id},
            # Allowed, barcode exists (A1), but for a different company
            {'name': 'A2', 'barcode': '3', 'company_id': company_b.id, 'categ_id': self.category.id},
        ]

        forbidden_products = [
            # Forbidden, collides with BC1
            {'name': 'F1', 'barcode': '1', 'company_id': False, 'categ_id': self.category.id},
            # Forbidden, collides with BC1
            {'name': 'F2', 'barcode': '1', 'company_id': company_a.id, 'categ_id': self.category.id},
            # Forbidden, collides with BC2
            {'name': 'F3', 'barcode': '2', 'company_id': company_b.id, 'categ_id': self.category.id},
            # Forbidden, collides with A1
            {'name': 'F4', 'barcode': '3', 'company_id': company_a.id, 'categ_id': self.category.id},
            # Forbidden, collides with A2
            {'name': 'F5', 'barcode': '3', 'company_id': company_b.id, 'categ_id': self.category.id},
            # Forbidden, collides with A1 and A2
            {'name': 'F6', 'barcode': '3', 'company_id': False, 'categ_id': self.category.id},
        ]

        for product in allowed_products:
            self.env['product.product'].create(product)

        for product in forbidden_products:
            with self.assertRaises(ValidationError):
                self.env['product.product'].create(product)

    def test_duplicated_barcodes_in_product_variants(self):
        """
        Create 2 variants with different barcodes and same company.
        Assign a duplicated barcode to one of them while changing the company.
        Barcode validation should be triggered and a duplicated barcode should be detected.
        """
        company_a = self.env.company
        company_b = self.env['res.company'].create({'name': 'CB'})

        variant_1 = self.template.product_variant_ids[0]
        variant_2 = self.template.product_variant_ids[1]

        variant_1.barcode = 'barcode_1'
        variant_1.company_id = company_a
        variant_2.barcode = 'barcode_2'
        variant_2.company_id = company_a

        with self.assertRaises(ValidationError):
            variant_2.write({
                'barcode': 'barcode_1',
                'company_id': company_b
            })

        # Variant 1 was not updated
        self.assertEqual(variant_2.barcode, 'barcode_2')
        self.assertEqual(variant_2.company_id, company_a)

        variant_2.write({
            'barcode': 'barcode_3',
            'company_id': company_b
        })

        self.assertEqual(variant_1.barcode, 'barcode_1')
        self.assertEqual(variant_1.company_id, company_b)
        self.assertEqual(variant_2.barcode, 'barcode_3')
        self.assertEqual(variant_2.company_id, company_b)
