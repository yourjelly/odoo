# Part of Odoo. See LICENSE file for full copyright and licensing details.

from freezegun import freeze_time

from odoo.fields import Command
from odoo.tests import tagged

from .common import PaymentMultiCompanyCommon, PaymentInvoicingCommon


@tagged('-at_install', 'post_install')
class TestAcquirers(PaymentMultiCompanyCommon):

    def test_compatible_acquirers(self):
        PaymentAcquirer = self.env['payment.acquirer']
        disabled_acquirer = self.manual_acquirer.copy({'state': 'disabled'})
        belgian_acquirer = self.manual_acquirer.copy({
            'country_ids': [Command.set(self.country_belgium.ids)],
            'state': 'enabled',
        })
        french_acquirer = self.manual_acquirer.copy({
            'country_ids': [Command.set(self.country_france.ids)],
            'state': 'enabled',
        })
        notokenization_acquirer = self.manual_acquirer.copy({
            'allow_tokenization': False,
            'state': 'enabled',
        })
        other_comp_acquirer = self.manual_acquirer.copy({
            'company_id': self.company_b.id,
            'state': 'enabled',
        })

        acquirers = PaymentAcquirer._get_compatible_acquirers(
            company_id=self.company_a.id,
            partner_id=self.default_partner.id,
            force_tokenization=True,
        )
        self.assertNotIn(notokenization_acquirer, acquirers)
        self.assertNotIn(other_comp_acquirer, acquirers)
        self.assertNotIn(french_acquirer, acquirers)
        self.assertNotIn(disabled_acquirer, acquirers)
        self.assertIn(belgian_acquirer, acquirers)

        preferred_acquirer_available = PaymentAcquirer._get_compatible_acquirers(
            company_id=self.company_a.id,
            partner_id=self.default_partner.id,
            preferred_acquirer_id=belgian_acquirer.id,
        )
        # Only the requested acquirer should be returned if available
        self.assertEqual(preferred_acquirer_available, belgian_acquirer)

        preferred_acquirer_unavailable = PaymentAcquirer._get_compatible_acquirers(
            company_id=self.company_a.id,
            partner_id=self.default_partner.id,
            preferred_acquirer_id=disabled_acquirer.id,
        )
        self.assertNotIn(disabled_acquirer, preferred_acquirer_unavailable)

    def test_references(self):
        PaymentTransaction = self.env['payment.transaction']
        provider = 'none'

        default_prefix = PaymentTransaction._compute_reference_prefix(provider, 'not used')
        self.assertEqual(default_prefix, '')

        prefixes = [
            "validation", "SO324", "INV345/34/34533", ".!", #"çaéèêë$", 
            "THIS IS A VERY LONG TRANSACTION PREFIX", "!{abcdef}--__--"]
        separators = ["#-_-#", "-abcde-", "x", "{}", "878675765"]
        # unsupported prefixes/separators : "[]", "{-}", "*-_x_-*", "\o/", "?"
        # TODO Test normalization: "€" removed, éèëç -> eeec
        for prefix in prefixes:
            print("PREFIX", prefix)
            reference = PaymentTransaction._compute_reference(provider, prefix, 'whatever')
            self.assertEqual(reference, prefix)
            self.create_transaction(flow='direct', reference=prefix) # reference = prefix
            for separator in separators:
                print("SEPARATOR", separator)
                reference = PaymentTransaction._compute_reference(provider, prefix, separator)
                self.assertEqual(reference, f'{prefix}{separator}{1}')

                tx1 = self.create_transaction(flow='direct', reference=reference)
                reference = PaymentTransaction._compute_reference(provider, prefix, separator)
                tx2 = self.create_transaction(flow='direct', reference=reference)
                self.assertEqual(reference, f'{prefix}{separator}{2}')

                tx2 = self.create_transaction(flow='direct', reference=f'{prefix}{separator}{450}')
                reference = PaymentTransaction._compute_reference(provider, prefix, separator)
                self.assertEqual(reference, f'{prefix}{separator}{451}')

        # TODO test creation of conflicting references & reference computation
        # TODO advanced tests to cover reference generation
        # based on different prefixes.

        # 1) test various prefixes
        # 2) test prefixes from values (invoice_ids, sale_order_id, ...)
        # 3) test singularized prefix
        pass

    def test_acquirers(self):
        # Test access rights ?
        # test create, unlink, copy
        # of acquirers
        pass


# # only this test needs the invoicingcommon to have a journal on the acquirer
# class TestAcquirersBis(PaymentInvoicingCommon):

#     def test_validation(self):
#         self.assertEqual(self.acquirer._get_validation_amount(), 0.0)
#         self.assertEqual(self.acquirer._get_validation_currency(), self.acquirer.journal_id.currency_id)

#         # If the journal has no acquirer, should fallback on the acquirer company currency
#         self.acquirer.journal_id = False
#         self.assertEqual(self.acquirer._get_validation_currency(), self.acquirer.company_id.currency_id)

#     # TODO Security check on main models
#     # Ensure no access to payment acquirers, tokens, transactions ?
#     # or only to accepted people
#     # TODO test some flows with lower rights than admin?
