from odoo.addons.l10n_pt.tests.test_l10n_pt_common import L10nPtTestCommon
from odoo import fields
from odoo.tests import tagged


@tagged('post_install', 'post_install_l10n', '-at_install')
class L10nPtTestQRCode(L10nPtTestCommon):
    def test_l10n_pt_qr_code_single_tax(self):
        """Ensures that taxes which are not part of the invoice are not mentioned in the QR code either"""
        invoice = self.create_invoice(taxes=[self.tax_normal, self.tax_normal], post=True)
        self.assertEqual(
            invoice.l10n_pt_qr_code_str,
            'A:123456789*B:999999990*C:BE*D:FT*E:N*F:20230101*G:TODO*H:0'
            '*I1:PT*I7:200.00*I8:46.00'
            '*N:46.00*O:246.00*Q:TODO*R:0'
        )

    def test_l10n_pt_qr_code_multiple_taxes(self):
        """Ensures that all possible taxes are correctly computed and exported"""
        invoice = self.create_invoice(taxes=[
            self.tax_normal, self.tax_normal, self.tax_normal, self.tax_intermediate, self.tax_reduced, self.tax_exempt_eu
        ], post=True)
        self.assertEqual(
            invoice.l10n_pt_qr_code_str,
            'A:123456789*B:999999990*C:BE*D:FT*E:N*F:20230101*G:TODO*H:0'
            '*I1:PT*I2:100.00*I3:100.00*I4:6.00*I5:100.00*I6:13.00*I7:300.00*I8:69.00'
            '*N:88.00*O:688.00*Q:TODO*R:0'
        )

    def test_l10n_pt_qr_code_different_currency(self):
        """Ensures that any foreign currency is correctly converted to EUR"""
        self.env['res.currency.rate'].create({
            'name': '2023-01-01',
            'rate': 2,
            'currency_id': self.env.ref('base.USD').id,
            'company_id': self.company_data['company'].id,
        })

        invoice = self.create_invoice(invoice_date='2023-01-01', taxes=[self.tax_normal], currency=self.env.ref('base.USD'), post=True)
        self.assertEqual(invoice.l10n_pt_qr_code_str,
                         'A:123456789*B:999999990*C:BE*D:FT*E:N*F:20230101*G:TODO*H:0'
                         '*I1:PT*I7:50.00*I8:11.50'
                         '*N:11.50*O:61.50*Q:TODO*R:0')

    def test_l10n_pt_qr_code_partner_vat(self):
        """Ensures that the QR code is correctly generated according to the partner's VAT"""
        # 999999990 is the default VAT for final consumers (without VAT)
        invoice = self.create_invoice(invoice_date='2023-01-01', taxes=[self.tax_normal], post=True)
        self.assertEqual(invoice.l10n_pt_qr_code_str,
                         'A:123456789*B:999999990*C:BE*D:FT*E:N*F:20230101*G:TODO*H:0'
                         '*I1:PT*I7:100.00*I8:23.00'
                         '*N:23.00*O:123.00*Q:TODO*R:0')
        # Portuguese VAT (no country prefix, defined in C: field)
        self.partner_a.country_id = self.env.ref('base.pt')
        self.partner_a.vat = 'PT529277212'
        invoice2 = self.create_invoice(invoice_date='2023-01-01', taxes=[self.tax_normal], post=True)
        self.assertEqual(invoice2.l10n_pt_qr_code_str,
                         'A:123456789*B:529277212*C:PT*D:FT*E:N*F:20230101*G:TODO*H:0'
                         '*I1:PT*I7:100.00*I8:23.00'
                         '*N:23.00*O:123.00*Q:TODO*R:0')
        # EU VAT (no country prefix either, defined in C: field)
        self.partner_b.country_id = self.env.ref('base.be')
        self.partner_b.vat = 'BE0987654394'
        invoice3 = self.create_invoice(invoice_date='2023-01-01', taxes=[self.tax_normal], partner=self.partner_b, post=True)
        self.assertEqual(invoice3.l10n_pt_qr_code_str,
                         'A:123456789*B:0987654394*C:BE*D:FT*E:N*F:20230101*G:TODO*H:0'
                         '*I1:PT*I7:100.00*I8:23.00'
                         '*N:23.00*O:123.00*Q:TODO*R:0')

    def test_l10n_pt_qr_code_credit_note(self):
        """Test different types of moves, e.g. a credit note"""
        invoice = self.create_invoice(taxes=[self.tax_normal], post=True)
        move_reversal = self.env['account.move.reversal'].with_context(active_model='account.move', active_ids=invoice.ids).create({
            'date': fields.Date.from_string('2023-01-01'),
            'reason': 'no reason',
            'refund_method': 'refund',
            'journal_id': invoice.journal_id.id,
        })
        reversal = move_reversal.reverse_moves()
        credit_note = self.env['account.move'].browse(reversal['res_id'])
        credit_note.action_post()
        self.assertEqual(credit_note.l10n_pt_qr_code_str,
                         'A:123456789*B:999999990*C:BE*D:NC*E:N*F:20230101*G:TODO*H:0'
                         '*I1:PT*I7:100.00*I8:23.00'
                         '*N:23.00*O:123.00*Q:TODO*R:0')

    def test_l10n_pt_qr_code_islands_azores(self):
        self.company_data['company'].write({
            'state_id': self.env.ref('base.state_pt_pt-20').id,
        })

        tax_normal = self._get_tax_by_xml_id('iva_pt_ac_sale_normal')
        tax_intermediate = self._get_tax_by_xml_id('iva_pt_ac_sale_intermedia')
        tax_reduced = self._get_tax_by_xml_id('iva_pt_ac_sale_reduzida')
        tax_exempt_eu = self._get_tax_by_xml_id('iva_pt_sale_eu_isenta')

        move = self.create_invoice('out_invoice', '2023-01-01', [tax_normal, tax_intermediate, tax_reduced, tax_exempt_eu], post=True)
        self.assertEqual(move.l10n_pt_qr_code_str,
                         'A:123456789*B:999999990*C:BE*D:FT*E:N*F:20230101*G:TODO*H:0'
                         '*J1:PT-AC*J2:100.00*J3:100.00*J4:4.00*J5:100.00*J6:9.00*J7:100.00*J8:16.00'
                         '*N:29.00*O:429.00*Q:TODO*R:0')

    def test_l10n_pt_qr_code_islands_madeira(self):
        self.company_data['company'].write({
            'state_id': self.env.ref('base.state_pt_pt-30').id,
        })

        tax_normal = self._get_tax_by_xml_id('iva_pt_ma_sale_normal')
        tax_intermediate = self._get_tax_by_xml_id('iva_pt_ma_sale_intermedia')
        tax_reduced = self._get_tax_by_xml_id('iva_pt_ma_sale_reduzida')
        tax_exempt_eu = self._get_tax_by_xml_id('iva_pt_sale_eu_isenta')

        move = self.create_invoice('out_invoice', '2023-01-01', [tax_normal, tax_intermediate, tax_reduced, tax_exempt_eu], post=True)
        self.assertEqual(move.l10n_pt_qr_code_str,
                         'A:123456789*B:999999990*C:BE*D:FT*E:N*F:20230101*G:TODO*H:0'
                         '*K1:PT-MA*K2:100.00*K3:100.00*K4:5.00*K5:100.00*K6:12.00*K7:100.00*K8:22.00'
                         '*N:39.00*O:439.00*Q:TODO*R:0')
