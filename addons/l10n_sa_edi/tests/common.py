# coding: utf-8
from datetime import datetime
from pytz import timezone

from odoo import Command, fields
from odoo.tests import tagged
from odoo.addons.account_edi.tests.common import AccountEdiTestCommon
from odoo.modules.module import get_resource_path


def mocked_l10n_sa_post_zatca_edi(edi_format, invoice):
    pass


@tagged('post_install_l10n', '-at_install', 'post_install')
class TestSaEdiCommon(AccountEdiTestCommon):

    @classmethod
    def setUpClass(cls, chart_template_ref='l10n_sa.sa_chart_template_standard', edi_format_ref='l10n_sa_edi.edi_sa_zatca'):
        super().setUpClass(chart_template_ref=chart_template_ref, edi_format_ref=edi_format_ref)

        cls.frozen_date = datetime(year=2022, month=9, day=5, hour=8, minute=20, second=2, tzinfo=timezone('Etc/GMT-3'))
        # Setup company
        cls.company = cls.company_data['company']
        cls.company.name = 'SA Company'
        cls.company.country_id = cls.env['res.country'].search([('code', '=', 'SA')])
        cls.company.email = "info@company.saexample.com"
        cls.company.phone = '+966 51 234 5678'
        cls.customer_invoice_journal = cls.env['account.journal'].search([('company_id', '=', cls.company.id), ('name', '=', 'Customer Invoices')])
        # customer_invoice_journal.l10n_sa_csr = 'LS0tLS1CRUdJTiBDRVJUSUZJQ0FURSBSRVFVRVNULS0tLS0KTUlJQ056Q0NBZDBDQVFBd2daNHhDekFKQmdOVkJBWVRBbE5CTVJNd0VRWURWUVFMREFvek1USXpNVEl6TkRVMgpNUk13RVFZRFZRUUtEQXBUUVNCRGIyMXdZVzU1TVJNd0VRWURWUVFEREFwVFFTQkRiMjF3WVc1NU1SZ3dGZ1lEClZRUmhEQTh6TVRJek1USXpORFUyTkRVMk56TXhEakFNQmdOVkJBZ01CVTFsWTJOaE1TWXdKQVlEVlFRSERCM1kKcDltRTJZWFlyOW1LMlliWXFTRFlwOW1FMllYWmh0bUkyTEhZcVRCV01CQUdCeXFHU000OUFnRUdCU3VCQkFBSwpBMElBQktZejNkNWRCVytzb2NBdHNVR1liLzZiRFNidU9McUFuUU5UNDFnK0I1Si9qZXVzMzhVTTExWU1uS01XCnVxZmJyZ0YvTWhPbEF4Zk5BV3I1VUhZQmN1aWdnZDR3Z2RzR0NTcUdTSWIzRFFFSkRqR0J6VENCeWpBaEJna3IKQmdFRUFZSTNGQUlFRkF3U1drRlVRMEV0UTI5a1pTMVRhV2R1YVc1bk1JR2tCZ05WSFJFRWdad3dnWm1rZ1pZdwpnWk14SURBZUJnTlZCQVFNRnpFdFQyUnZiM3d5TFRFMWZETXRNVEl6TkRVMk56ZzVNUjh3SFFZS0NaSW1pWlB5CkxHUUJBUXdQTXpFeU16RXlNelExTmpRMU5qY3pNUTB3Q3dZRFZRUU1EQVF4TURBd01TOHdMUVlEVlFRYURDWkIKYkNCQmJXbHlJRTF2YUdGdGJXVmtJRUpwYmlCQlltUjFiQ0JCZW1sNklGTjBjbVZsZERFT01Bd0dBMVVFRHd3RgpUM1JvWlhJd0NnWUlLb1pJemowRUF3SURTQUF3UlFJaEFMNWlnNHJLVXY1NGI0VTA1YnU1U3dGU2FKaGFTeTRuCnRxMFRKYittcDJ6aEFpQjhoUjd2TGlVeUhPOHNkRnNYNTBXdDNOemU2M1g0b3RKL1dsN2JKdmpwcEE9PQotLS0tLUVORCBDRVJUSUZJQ0FURSBSRVFVRVNULS0tLS0K'
        # customer_invoice_journal.l10n_sa_compliance_csid_json = '{"requestID": 1234567890123, "dispositionMessage": "ISSUED", "binarySecurityToken": "TUlJQ1hqQ0NBZ1NnQXdJQkFnSUdBWVZUMlAyak1Bb0dDQ3FHU000OUJBTUNNQlV4RXpBUkJnTlZCQU1NQ21WSmJuWnZhV05wYm1jd0hoY05Nakl4TWpJM01UTTFNREF5V2hjTk1qY3hNakkyTWpFd01EQXdXakNCbmpFTE1Ba0dBMVVFQmhNQ1UwRXhFekFSQmdOVkJBc01Dak14TWpNeE1qTTBOVFl4RXpBUkJnTlZCQW9NQ2xOQklFTnZiWEJoYm5reEV6QVJCZ05WQkFNTUNsTkJJRU52YlhCaGJua3hHREFXQmdOVkJHRU1Eek14TWpNeE1qTTBOVFkwTlRZM016RU9NQXdHQTFVRUNBd0ZUV1ZqWTJFeEpqQWtCZ05WQkFjTUhkaW4yWVRaaGRpdjJZclpodGlwSU5pbjJZVFpoZG1HMllqWXNkaXBNRll3RUFZSEtvWkl6ajBDQVFZRks0RUVBQW9EUWdBRXBqUGQzbDBGYjZ5aHdDMnhRWmh2L3BzTkp1NDR1b0NkQTFQaldENEhrbitONjZ6ZnhRelhWZ3ljb3hhNnA5dXVBWDh5RTZVREY4MEJhdmxRZGdGeTZLT0J1RENCdFRBTUJnTlZIUk1CQWY4RUFqQUFNSUdrQmdOVkhSRUVnWnd3Z1pta2daWXdnWk14SURBZUJnTlZCQVFNRnpFdFQyUnZiM3d5TFRFMWZETXRNVEl6TkRVMk56ZzVNUjh3SFFZS0NaSW1pWlB5TEdRQkFRd1BNekV5TXpFeU16UTFOalExTmpjek1RMHdDd1lEVlFRTURBUXhNREF3TVM4d0xRWURWUVFhRENaQmJDQkJiV2x5SUUxdmFHRnRiV1ZrSUVKcGJpQkJZbVIxYkNCQmVtbDZJRk4wY21WbGRERU9NQXdHQTFVRUR3d0ZUM1JvWlhJd0NnWUlLb1pJemowRUF3SURTQUF3UlFJZ2FxU1pRTFdMdkZXT3RaQ05BMWl4TjJkTVZtSGtmUVJpVHllZVRsWFNNcjhDSVFDc3puY3hjd0NMM3NhT3k2ZDF1T3J2N1RxMTl0Y01lc2IzZHBSbVFJcDVJQT09", "secret": "kss5lQZx6iSBG5OWhDjir+Z4FGQce4DzFokXgWEsZtY=", "errors": null}'
        # cls.company.l10n_sa_serial_number = '123456789'
        # cls.company.l10n_sa_private_key = '-----BEGIN EC PRIVATE KEY----- MHQCAQEEIPSllJSoBtrm1jgfTgb38cDbCxMd3CQajX0I7+KUDbYuoAcGBSuBBAAK oUQDQgAEpjPd3l0Fb6yhwC2xQZhv/psNJu44uoCdA1PjWD4Hkn+N66zfxQzXVgyc oxa6p9uuAX8yE6UDF80BavlQdgFy6A== -----END EC PRIVATE KEY----- '
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
        # cls.customer_invoice_journal.l10n_sa_api_get_compliance_CSID(otp='123345')
        # cls.customer_invoice_journal.l10n_sa_run_compliance_checks()
        # cls.customer_invoice_journal.l10n_sa_api_get_production_CSID('123456')
        # Setup partner
        # cls.partner_company = cls.env['res.partner'].search([('name', '=', 'Azure Interior')])
        # cls.partner_company.write({
        #     'l10n_sa_edi_building_number': '12300',
        #     'l10n_sa_edi_plot_identification': '2323',
        #     # 'l10n_sa_edi_neighborhood': 'Neighbor!',
        #     'l10n_sa_additional_identification_number': '353535353535353',
        # })
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
            'country_id': cls.env['res.country'].search([('code', '=', 'US')]).id,
            'state_id': cls.env['res.country.state'].search([('name', '=', 'California')]).id,
            # 'parent_id': cls.partner_company.id,
            'email': 'azure.Interior24@example.com',
            'phone': '(870)-931-0505',
            'company_type': 'company',
            'lang': 'en_US',
        })

        # 15% tax
        cls.tax_15 = cls.env['account.tax'].search([('company_id', '=', cls.company.id), ('name', '=', 'Sales Tax 15%')])

        # Large cabinet product
        cls.product = cls.env['product.product'].search([('default_code', '=', 'E-COM07')])
        cls.product_storage_box = cls.env['product.product'].search([('default_code', '=', 'E-COM08')])

        cls.standard_invoice_xml = get_resource_path('l10n_sa_edi', 'tests/compliance/standard', 'invoice.xml')

    def _create_invoice(self, **kwargs):
        vals = {
            'name': 'INV/2022/00014',
            'move_type': 'out_invoice',
            'company_id': self.company,
            'partner_id': self.partner_us,
            'invoice_date_due': '2022-09-22',
            'currency_id': self.company.currency_id,
            'invoice_line_ids': [Command.create({
                'product_id': self.product.id,
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
