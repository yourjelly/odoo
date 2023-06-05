# coding: utf-8
from datetime import datetime
from pytz import timezone

from odoo import Command
from odoo.tests import tagged
from odoo.addons.account_edi.tests.common import AccountEdiTestCommon


@tagged('post_install_l10n', '-at_install', 'post_install')
class TestSaEdiCommon(AccountEdiTestCommon):

    @classmethod
    def setUpClass(cls, chart_template_ref='l10n_sa.sa_chart_template_standard', edi_format_ref='l10n_sa_edi.edi_sa_zatca'):
        super().setUpClass(chart_template_ref=chart_template_ref, edi_format_ref=edi_format_ref)

        cls.frozen_date = datetime(year=2022, month=9, day=5, hour=8, minute=20, second=2, tzinfo=timezone('Etc/GMT-3'))
        # Setup company
        cls.company = cls.company_data['company']
        cls.company.name = 'SA Company'
        cls.company.country_id = cls.env.ref('base.sa')
        cls.company.email = "info@company.saexample.com"
        cls.company.phone = '+966 51 234 5678'
        cls.customer_invoice_journal = cls.env['account.journal'].search([('company_id', '=', cls.company.id), ('name', '=', 'Customer Invoices')])
        cls.company.l10n_sa_edi_building_number = '1234'
        cls.company.l10n_sa_edi_plot_identification = '1234'
        cls.company.street2 = "Testomania"
        cls.company.l10n_sa_additional_identification_number = '2525252525252'
        cls.company.l10n_sa_additional_identification_scheme = 'CRN'
        cls.company.vat = '311111111111113'
        cls.company.l10n_sa_private_key = cls.env['res.company']._l10n_sa_generate_private_key()
        cls.company.state_id = cls.env['res.country.state'].create({
            'name': 'riyadh',
            'code': 'RYA',
            'country_id': cls.company.country_id.id
        })
        cls.company.street = 'Al Amir Mohammed Bin Abdul Aziz Street'
        cls.company.city = 'المدينة المنورة'
        cls.company.zip = '42317'
        cls.customer_invoice_journal.l10n_sa_serial_number = '123456789'
        cls.customer_invoice_journal.l10n_sa_regen_csr()
        cls.partner_us = cls.env['res.partner'].create({
            'name': 'Chichi Lboukla',
            'ref': 'Azure Interior',
            'street': '4557 De Silva St',
            'l10n_sa_edi_building_number': '12300',
            'l10n_sa_edi_plot_identification': '2323',
            'l10n_sa_additional_identification_scheme': 'CRN',
            'l10n_sa_additional_identification_number': '353535353535353',
            'city': 'Fremont',
            'zip': '94538',
            'street2': 'Neighbor!',
            'country_id': cls.env.ref('base.us').id,
            'state_id': cls.env['res.country.state'].search([('name', '=', 'California')]).id,
            'email': 'azure.Interior24@example.com',
            'phone': '(870)-931-0505',
            'company_type': 'company',
            'lang': 'en_US',
        })

        cls.partner_sa = cls.env['res.partner'].create({
            'name': 'Chichi Lboukla',
            'ref': 'Azure Interior',
            'street': '4557 De Silva St',
            'l10n_sa_edi_building_number': '12300',
            'l10n_sa_edi_plot_identification': '2323',
            'l10n_sa_additional_identification_scheme': 'CRN',
            'l10n_sa_additional_identification_number': '353535353535353',
            'city': 'Fremont',
            'zip': '94538',
            'street2': 'Neighbor!',
            'country_id': cls.env.ref('base.sa').id,
            'state_id': cls.env['res.country.state'].search([('name', '=', 'California')]).id,
            'email': 'azure.Interior24@example.com',
            'phone': '(870)-931-0505',
            'company_type': 'company',
            'lang': 'en_US',
        })

        # 15% tax
        cls.tax_15 = cls.env['account.tax'].search([('company_id', '=', cls.company.id), ('name', '=', 'Sales Tax 15%')])

        # Large cabinet product
        cls.product_a = cls.env['product.product'].create({
            'name': 'Product A',
            'uom_id': cls.env.ref('uom.product_uom_unit').id,
            'standard_price': 320.0,
            'default_code': 'P0001',
        })
        cls.product_b = cls.env['product.product'].create({
            'name': 'Product B',
            'uom_id': cls.env.ref('uom.product_uom_unit').id,
            'standard_price': 15.8,
            'default_code': 'P0002',
        })

        cls.remove_ubl_extensions_xpath = '''<xpath expr="//*[local-name()='UBLExtensions']" position="replace"/>'''

    def _create_invoice(self, **kwargs):
        vals = {
            'name': 'INV/2022/00014',
            'move_type': 'out_invoice',
            'company_id': self.company,
            'partner_id': self.partner_us,
            'invoice_date_due': '2022-09-22',
            'currency_id': self.company.currency_id,
            'invoice_line_ids': [Command.create({
                'product_id': self.product_a.id,
                'price_unit': 320.0,
                'tax_ids': [Command.set(self.tax_15.ids)],
            }),
            ],
        }
        vals.update(kwargs)
        return self.env['account.move'].create(vals)

    def _create_debit_note(self, **kwargs):
        invoice = self._create_invoice(**kwargs)
        invoice.action_post()

        debit_note_wizard = self.env['account.debit.note'].with_context(
            {'active_ids': [invoice.id], 'active_model': 'account.move', 'default_copy_lines': True}).create({
                'reason': 'Totes forgot'})
        res = debit_note_wizard.create_debit()
        debit_note = self.env['account.move'].browse(res['res_id'])
        return debit_note

    def _create_credit_note(self, **kwargs):
        move = self._create_invoice(**kwargs)
        move.action_post()
        reverse_move = move._reverse_moves()

        move_reversal = self.env['account.move.reversal'].with_context(active_model="account.move", active_ids=move.ids).create({
            'reason': 'no reason',
            'refund_method': 'refund',
            'journal_id': move.journal_id.id,
        })
        reversal = move_reversal.reverse_moves()
        reverse_move = self.env['account.move'].browse(reversal['res_id'])
        return reverse_move
