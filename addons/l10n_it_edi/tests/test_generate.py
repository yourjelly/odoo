# -*- coding: utf-8 -*-
import time

from odoo.addons.account.tests.common import AccountTestInvoicingCommon
from odoo.tests import tagged, Form


@tagged('post_install', '-at_install')
class TestItalianElectronicInvoice(AccountTestInvoicingCommon):
    def test_state(self):
        self.env.company.write({
            'chart_template_id': self.env.ref('l10n_it.l10n_it_chart_template_generic').id
        })
        self.company_data = self.setup_company_data('Italy Company', country_id=self.env.ref('base.EUR').id)
        self.company = self.company_data['company']
        partner_form = Form(self.env['res.partner'])
        partner_form.name = 'Partner A'
        self.partner_id = partner_form.save()
        self.product_a = self.env.ref('product.product_product_3')
        invoice = self.init_invoice('out_invoice')
        # I check that Initially customer invoice state is "Draft"
        self.assertEqual(invoice.state, 'draft')

        invoice.post()

        # I check that customer invoice state is "Open"
        self.assertEqual(invoice.state, 'posted')

        # Electronic invoice must be present and have the same name as l10n_it_einvoice_name
        self.assertEqual(invoice.l10n_it_einvoice_id.name, invoice.l10n_it_einvoice_name)
