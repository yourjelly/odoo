# Part of Odoo. See LICENSE file for full copyright and licensing details.
from datetime import timedelta

from odoo import fields
from odoo.fields import Command
from odoo.tests import tagged
from odoo.addons.account.tests.common import AccountTestInvoicingCommon
from odoo.addons.l10n_in_edi_ewaybill.tests.common import L10ninEwaybillMockgateway


@tagged("post_install_l10n", "post_install", "-at_install")
class TestEdiEwaybillJson(AccountTestInvoicingCommon, L10ninEwaybillMockgateway):

    @classmethod
    def setUpClass(cls, chart_template_ref="in"):
        super().setUpClass(chart_template_ref=chart_template_ref)
        cls.env['ir.config_parameter'].set_param('l10n_in_edi.manage_invoice_negative_lines', True)
        cls.maxDiff = None
        cls.company_data["company"].write({
            "street": "Block no. 401",
            "street2": "Street 2",
            "city": "City 1",
            "zip": "500001",
            "state_id": cls.env.ref("base.state_in_ts").id,
            "country_id": cls.env.ref("base.in").id,
            "vat": "36AABCT1332L011",
            "l10n_in_edi_ewaybill_username": "username",
            "l10n_in_edi_ewaybill_password": "password",
            "l10n_in_edi_ewaybill_auth_validity": fields.Datetime.now() + timedelta(days=1),
        })
        cls.company_data["default_journal_sale"].write({
            'edi_format_ids': [(6, 0, [cls.env.ref("l10n_in_edi_ewaybill.edi_in_ewaybill_json_1_03").id])]
        })
        cls.partner_a.write({
            "vat": "36BBBFF5679L8ZR",
            "street": "Block no. 401",
            "street2": "Street 2",
            "city": "City 2",
            "zip": "500001",
            "state_id": cls.env.ref("base.state_in_ts").id,
            "country_id": cls.env.ref("base.in").id,
            "l10n_in_gst_treatment": "regular",
        })
        sgst_sale_5 = cls.env["account.chart.template"].ref("sgst_sale_5")
        cls.product_a.write({
            "l10n_in_hsn_code": "01111",
            'taxes_id': sgst_sale_5,
        })
        cls.product_a2 = cls.env['product.product'].create({
            'name': 'product_a2',
            'uom_id': cls.env.ref('uom.product_uom_unit').id,
            'lst_price': 1000.0,
            'standard_price': 1000.0,
            'property_account_income_id': cls.company_data['default_account_revenue'].id,
            'property_account_expense_id': cls.company_data['default_account_expense'].id,
            'taxes_id': [Command.set(sgst_sale_5.ids)],
            "l10n_in_hsn_code": "01111",
        })
        cls.product_a_discount = cls.env['product.product'].create({
            'name': 'product_a discount',
            'uom_id': cls.env.ref('uom.product_uom_unit').id,
            'lst_price': 400.0,
            'standard_price': 400.0,
            'property_account_income_id': cls.company_data['default_account_revenue'].id,
            'property_account_expense_id': cls.company_data['default_account_expense'].id,
            'taxes_id': [Command.set(sgst_sale_5.ids)],
            "l10n_in_hsn_code": "01111",
        })
        gst_with_cess = cls.env.ref("account.%s_sgst_sale_12" % (cls.company_data["company"].id)
                                    ) + cls.env.ref(
            "account.%s_cess_5_plus_1591_sale" % (cls.company_data["company"].id))
        product_with_cess = cls.env["product.product"].create({
            "name": "product_with_cess",
            "uom_id": cls.env.ref("uom.product_uom_unit").id,
            "lst_price": 1000.0,
            "standard_price": 800.0,
            "property_account_income_id": cls.company_data["default_account_revenue"].id,
            "property_account_expense_id": cls.company_data["default_account_expense"].id,
            "taxes_id": [Command.set(gst_with_cess.ids)],
            "l10n_in_hsn_code": "02222",
        })
        cls.invoice = cls.init_invoice("out_invoice", post=False, products=cls.product_a + product_with_cess)
        cls.invoice.write({
            "invoice_line_ids": [(1, l_id, {"discount": 10}) for l_id in cls.invoice.invoice_line_ids.ids]})
        cls.invoice_full_discount = cls.init_invoice("out_invoice", post=False, products=cls.product_a)
        cls.invoice_full_discount.write({
            "invoice_line_ids": [(1, l_id, {"discount": 100}) for l_id in
                                 cls.invoice_full_discount.invoice_line_ids.ids]})
        cls.invoice_zero_qty = cls.init_invoice("out_invoice", post=False, products=cls.product_a)
        cls.invoice_zero_qty.write({
            "invoice_line_ids": [(1, l_id, {"quantity": 0}) for l_id in cls.invoice_zero_qty.invoice_line_ids.ids]})

    def test_ediewaybill_json_1(self):
        (self.invoice + self.invoice_full_discount + self.invoice_zero_qty).write({
            "l10n_in_type_id": self.env.ref("l10n_in_edi_ewaybill.type_tax_invoice_sub_type_supply"),
            "l10n_in_distance": 20,
            "l10n_in_mode": "1",
            "l10n_in_vehicle_no": "GJ11AA1234",
            "l10n_in_vehicle_type": "R",
        })
        (self.invoice + self.invoice_full_discount + self.invoice_zero_qty).action_post()
        with self.MockL10ninEwaybill():
            self.invoice.action_process_edi_web_services()
            self.invoice_full_discount.action_process_edi_web_services()
            self.invoice_zero_qty.action_process_edi_web_services()
