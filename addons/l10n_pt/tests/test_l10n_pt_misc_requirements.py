from freezegun import freeze_time
from odoo.addons.l10n_pt.tests.test_l10n_pt_common import L10nPtTestCommon
from odoo.exceptions import UserError
from odoo.models import Model
from odoo.tests import tagged


@tagged('post_install', 'post_install_l10n', '-at_install')
class L10nPtTestMiscRequirements(L10nPtTestCommon):
    def test_l10n_pt_product(self):
        """ Test that we cannot change the name of a product that is already used in invoices"""
        self.product_a.name = 'New name should be OK'
        self.create_invoice(products=[self.product_a], post=True)
        with self.assertRaisesRegex(UserError, 'You cannot change the name of a product that is already used in issued invoices.'):
            self.product_a.name = 'This new name should not be allowed'

    def test_l10n_pt_partner(self):
        # Test that we cannot change the VAT number of a partner that already has issued invoices
        self.partner_a.vat = 'BE0477472701'
        self.create_invoice(partner=self.partner_a, post=True)
        with self.assertRaisesRegex(UserError, 'You cannot change the VAT number of a partner that already has issued invoices.'):
            self.partner_a.vat = 'BE0999999999'

        # Except it it's the generic VAT number of final consumers (999999990)
        Model.write(self.partner_a, {'vat': 'PT999999990'})  # Bypass the constraint
        self.partner_a.vat = 'BE0477472701'  # This should be OK

        # Test that we cannot change the name of a partner that already has issued invoices but no VAT number
        # This restriction can be removed by adding the VAT number of the partner
        self.partner_b.vat = False
        self.partner_b.name = 'This new name should be allowed'
        self.partner_b.country_id = self.env.ref('base.fr')
        self.create_invoice(partner=self.partner_b, post=True)
        with self.assertRaisesRegex(UserError, 'You cannot change the name of a partner that already has issued invoices but no VAT number.'):
            self.partner_b.name = 'This new name should not be allowed'
        self.partner_b.vat = 'BE0475646428'
        self.partner_b.name = 'This new name should be allowed'

    def test_l10n_pt_future_invoice_date(self):
        """
        "When the document issuing date is later than the current date, or superior than the date on the system,
        no other document may be issued with the current or previous date within the same series" - Portuguese Tax Authority
        """
        with freeze_time('2023-01-05'):
            self.create_invoice(invoice_date='2023-01-04', post=True)
            self.create_invoice(invoice_date='2023-01-03', post=True)
            invoice1 = self.create_invoice(invoice_date='2023-01-05', post=True)
            self.assertEqual(invoice1.l10n_pt_show_future_date_warning, False)
            invoice2 = self.create_invoice(invoice_date='2023-01-06', post=True)
            self.assertEqual(invoice2.l10n_pt_show_future_date_warning, True)
            self.create_invoice(move_type='in_refund', invoice_date='2023-01-02', post=True)  # Other journal, no problem
            with self.assertRaisesRegex(UserError, 'You cannot create an invoice with a date anterior to the last invoice.*'):
                self.create_invoice(invoice_date='2023-01-02', post=True)
            with self.assertRaisesRegex(UserError, 'You cannot create an invoice with a date anterior to the last invoice.*'):
                self.create_invoice(invoice_date='2023-01-05', post=True)
            self.create_invoice(invoice_date='2023-01-06', post=True)
        with freeze_time('2023-01-06'):
            self.create_invoice(invoice_date='2023-01-03', post=True)
            self.create_invoice(invoice_date='2023-01-06', post=True)
            self.create_invoice(invoice_date='2023-01-04', post=True)
            self.create_invoice(invoice_date='2023-01-07', post=True)
            with self.assertRaisesRegex(UserError, 'You cannot create an invoice with a date anterior to the last invoice.*'):
                self.create_invoice(invoice_date='2023-01-06', post=True)
