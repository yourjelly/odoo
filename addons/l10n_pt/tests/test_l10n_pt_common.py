from odoo.addons.account.tests.common import AccountTestInvoicingCommon
from odoo import fields, Command


class L10nPtTestCommon(AccountTestInvoicingCommon):
    @classmethod
    def setUpClass(cls, chart_template_ref='pt'):
        super().setUpClass(chart_template_ref=chart_template_ref)

        cls.company_data['company'].write({
            'city': 'Lisboa',
            'zip': '1234-789',
            'vat': 'PT123456789',
            'company_registry': '123456',
            'country_id': cls.env.ref('base.pt').id
        })
        cls.partner_a['country_id'] = cls.env.ref('base.be').id

        cls.tax_normal = cls._get_tax_by_xml_id('iva_pt_sale_normal')
        cls.tax_intermediate = cls._get_tax_by_xml_id('iva_pt_sale_intermedia')
        cls.tax_reduced = cls._get_tax_by_xml_id('iva_pt_sale_reduzida')
        cls.tax_exempt_eu = cls._get_tax_by_xml_id('iva_pt_sale_eu_isenta')

    @classmethod
    def _get_tax_by_xml_id(cls, xml_id):
        return cls.env.ref(f"l10n_pt.{cls.company_data['company'].id}_{xml_id}")

    def create_invoice(self, move_type='out_invoice', invoice_date='2023-01-01', taxes=None, currency=None, partner=None, products=None, post=False):
        if taxes is None:
            taxes = [self.tax_normal]
        if products is None:
            products = [self.product_a]
        move = self.env['account.move'].create({
            'move_type': move_type,
            'partner_id': (partner or self.partner_a).id,
            'date': fields.Date.from_string(invoice_date),
            'invoice_date': fields.Date.from_string(invoice_date),
            'currency_id': (currency or self.company_data['company'].currency_id).id,
            'invoice_line_ids': [
                Command.create({
                    'product_id': product.id,
                    'quantity': 1,
                    'price_unit': 100,
                    'tax_ids': [tax.id],
                })
                for tax in taxes
                for product in products
            ]
        })
        if post:
            move.action_post()
        return move
