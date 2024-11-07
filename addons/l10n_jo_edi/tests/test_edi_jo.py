from odoo import Command
from odoo.tests import tagged
from odoo.tools import misc
from odoo.addons.account_reports.tests.common import TestAccountReportsCommon
from odoo.addons.l10n_jo_edi.tests.test_jo_checks import JoEdiCommon


@tagged('post_install_l10n', 'post_install', '-at_install')
class TestEdiJo(JoEdiCommon):
    @classmethod
    @TestAccountReportsCommon.setup_country('jo')
    def setUpClass(cls):
        super().setUpClass()
        cls.company_data['company'].write({
            'name': 'Jordan Company',
            'vat': '8000514',
        })

        def _create_tax(amount, amount_type):
            return cls.env['account.tax'].create(
                {
                    'name': f'{amount_type} {amount}',
                    'amount_type': amount_type,
                    'amount': amount,
                    'company_id': cls.company_data['company'].id,
                    'include_base_amount': amount_type == 'fixed',
                    'is_base_affected': amount_type == 'percent',
                    'sequence': 2 if amount_type == 'percent' else 1,
                })

        cls.jo_general_tax_10 = _create_tax(10, 'percent')
        cls.jo_special_tax_10 = _create_tax(10, 'fixed')
        cls.jo_special_tax_5 = _create_tax(5, 'fixed')
        cls.jo_general_tax_16_included = _create_tax(16, 'percent')
        cls.jo_general_tax_16_included.price_include_override = 'tax_included'

        cls.partner_jo = cls.env['res.partner'].create({
            'name': 'Ahmad',
            'ref': 'Jordan Partner',
            'city': 'Amman',
            'vat': '54321',
            'zip': '94538',
            'country_id': cls.env.ref('base.jo').id,
            'state_id': cls.env.ref('base.state_jo_az').id,
            'phone': '+962 795-5585-949',
            'company_type': 'company',
        })

        # The rate of 1 USD = 2 JOD is meant to simplify tests
        cls.usd = cls.env.ref('base.USD')
        cls.setup_currency_rate(cls.usd, 0.5)

    @classmethod
    def setup_currency_rate(cls, currency, rate):
        currency.sudo().rate_ids.unlink()
        return cls.env['res.currency.rate'].create({
            'name': '2019-01-01',
            'rate': rate,
            'currency_id': currency.id,
            'company_id': cls.company_data['company'].id,
        })

    def _structure_move_vals(self, move_vals):
        return {
            'name': move_vals['name'],
            'move_type': move_vals['type'],
            'company_id': self.company.id,
            'partner_id': self.partner_jo.id,
            'invoice_date': move_vals.get('date', '2019-01-01'),
            'currency_id': move_vals.get('currency', self.company.currency_id).id,
            'narration': move_vals.get('narration'),
            'invoice_line_ids': [Command.create({
                'product_id': line['product_id'].id,
                'price_unit': line['price'],
                'quantity': line['quantity'],
                'discount': line['discount_percent'],
                'currency_id': move_vals.get('currency', self.company.currency_id).id,
                'tax_ids': [Command.set([tax.id for tax in line.get('tax_ids', [])])],
            }) for line in move_vals.get('lines', [])],
        }

    def _create_invoice(self, invoice_vals):
        invoice_vals['type'] = 'out_invoice'
        vals = self._structure_move_vals(invoice_vals)
        move = self.env['account.move'].create(vals)
        move.action_post()
        return move

    def _create_refund(self, refund_vals, return_reason, invoice_vals):
        invoice = self._create_invoice(invoice_vals)
        reversal = self.env['account.move.reversal'].with_context(active_model="account.move", active_ids=invoice.ids).create({
            'reason': return_reason,
            'journal_id': invoice.journal_id.id,
        }).refund_moves()
        reverse_move = self.env['account.move'].browse(reversal['res_id'])
        refund_vals['type'] = 'out_refund'
        if 'lines' in refund_vals:
            # because they will be set by refund_vals
            reverse_move.invoice_line_ids = [Command.clear()]
        reverse_move.update(self._structure_move_vals(refund_vals))
        reverse_move.action_post()
        return reverse_move

    def _read_xml_test_file(self, file_name):
        with misc.file_open(f'l10n_jo_edi/tests/test_files/{file_name}.xml', 'rb') as file:
            result_file = file.read()
        return result_file

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

    def test_jo_sales_invoice_precision(self):
        self.setup_currency_rate(self.usd, 1.41)
        self.company.l10n_jo_edi_taxpayer_type = 'sales'
        self.company.l10n_jo_edi_sequence_income_source = '16683693'

        invoice_values = {
            'name': 'TestEIN022',
            'currency': self.usd,
            'date': '2023-11-12',
            'lines': [
                {
                    'product_id': self.product_a,
                    'quantity': 3.48,
                    'price': 1.56,
                    'discount_percent': 2.5,
                    'tax_ids': [self.jo_general_tax_16_included],
                },
                {
                    'product_id': self.product_b,
                    'quantity': 6.02,
                    'price': 2.79,
                    'discount_percent': 2.5,
                    'tax_ids': [self.jo_general_tax_16_included],
                },
            ],
        }
        invoice = self._create_invoice(invoice_values)

        generated_file = self.env['account.edi.xml.ubl_21.jo']._export_invoice(invoice)
        errors = self.validate_jo_edi_numbers(generated_file)
        self.assertFalse(errors, errors)
