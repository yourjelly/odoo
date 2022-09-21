# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
import json

from odoo.tests import tagged
from odoo.addons.account.tests.common import AccountTestInvoicingCommon

_logger = logging.getLogger(__name__)


@tagged('post_install_l10n', 'post_install', '-at_install')
class TestKeEdi(AccountTestInvoicingCommon):

    @classmethod
    def setUpClass(cls, chart_template_ref='l10n_ke.l10nke_chart_template'):
        super().setUpClass(chart_template_ref=chart_template_ref)

        # ==== Company ====
        cls.company_data['company'].write({
            'l10n_ke_device_sender_id': 'test-sender-id',
            'l10n_ke_device_url': 'http://device_ip/EsdApi/deononline/signinvoice',
            'l10n_ke_device_proxy_url': 'http://local_proxy_ip/forward',
        })

        # ==== Partner ====
        cls.partner_a.write({
            'country_id': cls.env.ref('base.ke').id,
            'vat': 'A000123456F',
        })

        # ==== Products ====
        cls.product_a.write({
            'l10n_ke_hsn_code': '10021000',
            'l10n_ke_hsn_name': 'Wry rye joke',
        })

        cls.product_b.write({
            'l10n_ke_hsn_code': '19021100',
            'l10n_ke_hsn_name': 'Pasta la vista',
        })

        # ==== Taxes ====
        cls.tax_sixteen_included = cls.env['account.tax'].create({
            'name': '16% price included tax',
            'amount': 16,
            'amount_type': 'percent',
            'price_include': True,
            'include_base_amount': True,
            'company_id': cls.company_data['company'].id,
        })

        cls.tax_eight = cls.env['account.tax'].create({
            'name': '8% tax exlcluded tax',
            'amount': 8,
            'amount_type': 'percent',
            'company_id': cls.company_data['company'].id,
        })

        cls.tax_zero = cls.env['account.tax'].create({
            'name': '0% price exlcuded tax',
            'amount': 0,
            'amount_type': 'percent',
            'company_id': cls.company_data['company'].id,
        })

        cls.tax_twenty = cls.env['account.tax'].create({
            'name': '20% price exlcuded tax',
            'amount': 20,
            'amount_type': 'percent',
            'company_id': cls.company_data['company'].id,
        })

        # ==== Invoices ====
        cls.invoice_a = cls.env['account.move'].create({
            'move_type': 'out_invoice',
            'partner_id': cls.partner_a.id,
            'invoice_date': '2022-09-22',
            'date': '2022-09-21',
            'currency_id': cls.env.ref('base.KES').id,
            'invoice_line_ids': [
                (0, 0, {
                    # Special characters should be removed from the name
                    'name': 'line_1',
                    'price_unit': 123.45,
                    'product_id': cls.product_a.id,
                    'quantity': 4,
                    'tax_ids': [(6, 0, [cls.tax_sixteen_included.id])],
                }),
                (0, 0, {
                    'name': 'lineʢ◉ᴥ◉ʡ2',
                    'price_unit': 100,
                    'product_id': cls.product_b.id,
                    'quantity': 3,
                    'tax_ids': [(6, 0, [cls.tax_eight.id])],
                }),
                (0, 0, {
                    'name': 'line 3',
                    'price_unit': 75,
                    'product_id': cls.product_a.id,
                    'quantity': 2,
                    'tax_ids': [(6, 0, [cls.tax_zero.id])],
                }),
                (0, 0, {
                    'name': 'line4',
                    'price_unit': 50,
                    'product_id': cls.product_b.id,
                    'quantity': 1,
                    'tax_ids': [(6, 0, [cls.tax_twenty.id])],
                }),
            ],
        })


    def test_invoice_export(self):
        expected_invoice_dict = {
            "senderId": "test-sender-id",
            "invoiceCategory": "tax_invoice",
            "traderSystemInvoiceNumber": "INV202200001",
            "relevantInvoiceNumber": "",
            "pinOfBuyer": "A000123456F",
            "invoiceType": "Original",
            "exemptionNumber": "",
            "totalInvoiceAmount": 1027.8,
            "systemUser": "Because I am accountman",
            "deonItemDetails": [{
                "hsDesc": 'Wry rye joke',
                "hsCode": "10021000",
                "namePLU": "line1",
                "taxRate": 16.0,
                "unitPrice": 106.42,
                "discount": 0.0,
                "quantity": 4.0,
                "measureUnit": "",
                "vatClass": "A"
            }, {
                "hsDesc": 'Pasta la vista',
                "hsCode": "19021100",
                "namePLU": "line2",
                "taxRate": 8.0,
                "unitPrice": 100.0,
                "discount": 0.0,
                "quantity": 3.0,
                "measureUnit": "",
                "vatClass": "B"
            }, {
                "hsDesc": 'Wry rye joke',
                "hsCode": "10021000",
                "namePLU": "line 3",
                "taxRate": 0.0,
                "unitPrice": 75.0,
                "discount": 0.0,
                "quantity": 2.0,
                "measureUnit": "",
                "vatClass": "C"
            }, {
                "hsDesc": 'Pasta la vista',
                "hsCode": "19021100",
                "namePLU": "line4",
                "taxRate": 20.0,
                "unitPrice": 50.0,
                "discount": 0.0,
                "quantity": 1.0,
                "measureUnit": "",
                "vatClass": "D"
            }]}

        invoice_json = self.invoice_a._l10n_ke_edi_copycat_prepare_export_values()
        self.assertEqual(expected_invoice_dict, json.loads(invoice_json))
