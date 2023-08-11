# -*- coding: utf-8 -*-

from odoo.addons.account.tests.common import AccountTestInvoicingCommon
from odoo.tests import tagged


@tagged('post_install', '-at_install')
class TestAccountPaymentTerms(AccountTestInvoicingCommon):
    @classmethod
    def setUpClass(cls, chart_template_ref=None):
        super().setUpClass(chart_template_ref=chart_template_ref)

        cls.env.user.company_id = cls.company_data['company']
        cls.product_without_company = cls.env['product.template'].create({
            'name': 'Product Without a Company',
        })
        cls.product_with_company = cls.env['product.template'].create({
            'name': 'Product With a Company',
            'company_id': cls.company_data['company'].id
        })

    def test_multi_company_product_tax(self):
        """ Ensure default taxes are set for all companies on products with no company set. """
        companies = self.env['res.company'].sudo().search([])
        # Product should have all the default taxes of the other companies.
        self.assertRecordValues(self.product_without_company, [{
            'taxes_id': companies.account_sale_tax_id.ids,
            'supplier_taxes_id': companies.account_purchase_tax_id.ids}])
        # Product should have only the default tax of the company it belongs to.
        self.assertRecordValues(self.product_with_company, [{
            'taxes_id': self.company_data['company'].account_sale_tax_id.ids,
            'supplier_taxes_id': self.company_data['company'].account_purchase_tax_id.ids}])
