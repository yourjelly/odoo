from odoo.tests import tagged
from odoo.addons.l10n_jo_edi.tests.jo_edi_common import JoEdiCommon


@tagged('post_install_l10n', 'post_install', '-at_install')
class TestJoEdiTypes(JoEdiCommon):
    def test_jo_income_invoice(self):
        self.company.l10n_jo_edi_taxpayer_type = 'income'
        self.company.l10n_jo_edi_sequence_income_source = '4419618'

        invoice_vals = {
            'name': 'EIN/998833/0',
            'date': '2022-09-27',
            'narration': 'ملاحظات 2',
            'lines': [
                {
                    'product_id': self.product_a,
                    'price': 3,
                    'quantity': 44,
                    'discount_percent': 1,
                },
            ]
        }
        invoice = self._create_invoice(invoice_vals)

        expected_file = self._read_xml_test_file('type_1')
        generated_file = self.env['account.edi.xml.ubl_21.jo']._export_invoice(invoice)
        self.assertXmlTreeEqual(
            self.get_xml_tree_from_string(generated_file),
            self.get_xml_tree_from_string(expected_file)
        )

    def test_jo_income_refund(self):
        self.company.l10n_jo_edi_taxpayer_type = 'income'
        self.company.l10n_jo_edi_sequence_income_source = '4419618'

        invoice_vals = {
            'name': 'EIN00017',
            'lines': [
                {
                    'product_id': self.product_a,
                    'price': 18.85,
                    'quantity': 10,
                    'discount_percent': 20,
                },
            ],
        }
        refund_vals = {
            'name': 'EIN998833',
            'date': '2022-09-27',
            'narration': 'ملاحظات 2',
            'lines': [
                {
                    'product_id': self.product_a,
                    'price': 3,
                    'quantity': 44,
                    'discount_percent': 1,
                },
            ],
        }
        refund = self._create_refund(refund_vals, 'change price', invoice_vals)

        expected_file = self._read_xml_test_file('type_2')
        generated_file = self.env['account.edi.xml.ubl_21.jo']._export_invoice(refund)
        self.assertXmlTreeEqual(
            self.get_xml_tree_from_string(generated_file),
            self.get_xml_tree_from_string(expected_file)
        )

    def test_jo_sales_invoice(self):
        self.company.l10n_jo_edi_taxpayer_type = 'sales'
        self.company.l10n_jo_edi_sequence_income_source = '16683693'

        invoice_values = {
            'name': 'TestEIN022',
            'date': '2023-11-10',
            'narration': 'Test General for Documentation',
            'lines': [
                {
                    'product_id': self.product_a,
                    'price': 10,
                    'quantity': 100,
                    'discount_percent': 10,
                    'tax_ids': [self.jo_general_tax_10],
                },
            ],
        }
        invoice = self._create_invoice(invoice_values)

        expected_file = self._read_xml_test_file('type_3')
        generated_file = self.env['account.edi.xml.ubl_21.jo']._export_invoice(invoice)
        self.assertXmlTreeEqual(
            self.get_xml_tree_from_string(generated_file),
            self.get_xml_tree_from_string(expected_file)
        )

    def test_jo_sales_refund(self):
        self.company.l10n_jo_edi_taxpayer_type = 'sales'
        self.company.l10n_jo_edi_sequence_income_source = '16683693'

        invoice_vals = {
            'name': 'TestEIN022',
            'lines': [
                {
                    'product_id': self.product_a,
                    'price': 10,
                    'quantity': 100,
                    'discount_percent': 10,
                    'tax_ids': [self.jo_general_tax_10],
                },
            ],
        }
        refund_vals = {
            'name': 'TestEIN022R',
            'date': '2023-11-10',
        }
        refund = self._create_refund(refund_vals, 'Test/Return', invoice_vals)

        expected_file = self._read_xml_test_file('type_4')
        generated_file = self.env['account.edi.xml.ubl_21.jo']._export_invoice(refund)
        self.assertXmlTreeEqual(
            self.get_xml_tree_from_string(generated_file),
            self.get_xml_tree_from_string(expected_file)
        )

    def test_jo_sales_refund_usd(self):
        """
        same test as above, but with price divided over 2
        the division would compensate for the USD exchange rate
        """
        self.company.l10n_jo_edi_taxpayer_type = 'sales'
        self.company.l10n_jo_edi_sequence_income_source = '16683693'

        invoice_vals = {
            'name': 'TestEIN022',
            'currency': self.usd,
            'lines': [
                {
                    'product_id': self.product_a,
                    'price': 5,
                    'quantity': 100,
                    'discount_percent': 10,
                    'tax_ids': [self.jo_general_tax_10],
                },
            ],
        }
        refund_vals = {
            'name': 'TestEIN022R',
            'currency': self.usd,
            'date': '2023-11-10',
        }
        refund = self._create_refund(refund_vals, 'Test/Return', invoice_vals)

        expected_file = self._read_xml_test_file('type_4')
        generated_file = self.env['account.edi.xml.ubl_21.jo']._export_invoice(refund)
        self.assertXmlTreeEqual(
            self.get_xml_tree_from_string(generated_file),
            self.get_xml_tree_from_string(expected_file)
        )

    def test_jo_special_invoice(self):
        self.company.l10n_jo_edi_taxpayer_type = 'special'
        self.company.l10n_jo_edi_sequence_income_source = '16683696'

        invoice_vals = {
            'name': 'TestEIN013',
            'date': '2023-11-10',
            'lines': [
                {
                    'product_id': self.product_b,
                    'price': 100,
                    'quantity': 1,
                    'discount_percent': 0,
                    'tax_ids': [self.jo_general_tax_10, self.jo_special_tax_10],
                },
            ],
        }
        invoice = self._create_invoice(invoice_vals)

        expected_file = self._read_xml_test_file('type_5')
        generated_file = self.env['account.edi.xml.ubl_21.jo']._export_invoice(invoice)
        self.assertXmlTreeEqual(
            self.get_xml_tree_from_string(generated_file),
            self.get_xml_tree_from_string(expected_file)
        )

    def test_jo_special_refund(self):
        self.company.l10n_jo_edi_taxpayer_type = 'special'
        self.company.l10n_jo_edi_sequence_income_source = '16683696'

        invoice_vals = {
            'name': 'TestEIN013',
            'lines': [
                {
                    'product_id': self.product_b,
                    'price': 100,
                    'quantity': 1,
                    'discount_percent': 0,
                    'tax_ids': [self.jo_general_tax_10, self.jo_special_tax_10],
                },
            ],
        }
        refund_vals = {
            'name': 'TestEINReturn013',
            'date': '2023-11-10',
        }
        refund = self._create_refund(refund_vals, 'Test Return', invoice_vals)

        expected_file = self._read_xml_test_file('type_6')
        generated_file = self.env['account.edi.xml.ubl_21.jo']._export_invoice(refund)
        self.assertXmlTreeEqual(
            self.get_xml_tree_from_string(generated_file),
            self.get_xml_tree_from_string(expected_file)
        )

    def test_jo_special_refund_usd(self):
        self.company.l10n_jo_edi_taxpayer_type = 'special'
        self.company.l10n_jo_edi_sequence_income_source = '16683696'

        invoice_vals = {
            'name': 'TestEIN013',
            'currency': self.usd,
            'lines': [
                {
                    'product_id': self.product_b,
                    'price': 50,
                    'quantity': 1,
                    'discount_percent': 0,
                    'tax_ids': [self.jo_general_tax_10, self.jo_special_tax_5],
                },
            ],
        }
        refund_vals = {
            'name': 'TestEINReturn013',
            'currency': self.usd,
            'date': '2023-11-10',
        }
        refund = self._create_refund(refund_vals, 'Test Return', invoice_vals)

        expected_file = self._read_xml_test_file('type_6')
        generated_file = self.env['account.edi.xml.ubl_21.jo']._export_invoice(refund)
        self.assertXmlTreeEqual(
            self.get_xml_tree_from_string(generated_file),
            self.get_xml_tree_from_string(expected_file)
        )
