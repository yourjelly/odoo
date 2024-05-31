# Part of Odoo. See LICENSE file for full copyright and licensing details.

from freezegun import freeze_time

from odoo import Command
from odoo.addons.l10n_it_edi_doi.tests.common import TestItEdiDoi
from odoo.addons.product.tests.common import ProductCommon
from odoo.tests import tagged, Form


@tagged('post_install_l10n', 'post_install', '-at_install')
class TestItEdiDoiRemaining(TestItEdiDoi, ProductCommon):

    def test_invoice_line_edit(self):
        """
        Ensure the warnings are computed correctly when editing line values on an invoice.
        """
        declaration = self.declaration_1000
        declaration_tax = declaration.company_id.l10n_it_edi_doi_declaration_of_intent_tax

        self.assertRecordValues(declaration, [{
            'invoiced': 0.0,
            'draft_amount': 0.0,
            'not_yet_invoiced': 0.0,
            'remaining': 1000.0,
        }])

        invoice = self.env['account.move'].create({
            'move_type': 'out_invoice',
            'company_id': self.company.id,
            'partner_id': declaration.partner_id.id,
            'invoice_date': declaration.start_date,
            'l10n_it_edi_doi_declaration_of_intent_id': declaration.id,
            'invoice_line_ids': [
                Command.create({
                    'name': 'declaration line',
                    'quantity': 1,
                    'price_unit': 1000.0,  # == declaration.threshold
                    'tax_ids': [Command.set(declaration_tax.ids)],
                }),
            ],
        })
        self.assertEqual(invoice.l10n_it_edi_doi_warning, "")

        invoice_form = Form(invoice)
        with invoice_form.invoice_line_ids.edit(0) as line_form:
            line_form.price_unit = 2000
            line_form.save()
            self.assertEqual(
                invoice_form.l10n_it_edi_doi_warning,
                "Pay attention, the threshold of your Declaration of Intent test 2019-threshold 1000 of 1,000.00\xa0€ is exceeded by 1,000.00\xa0€, this document included.\n"
                "Invoiced: 2,000.00\xa0€; Not Yet Invoiced: 0.00\xa0€"
            )

    def test_sale_order_line_edit(self):
        """
        Ensure the warnings are computed correctly when editing line values on a quotation or sale order.
        """
        declaration = self.declaration_1000
        declaration_tax = declaration.company_id.l10n_it_edi_doi_declaration_of_intent_tax

        self.assertRecordValues(declaration, [{
            'invoiced': 0.0,
            'draft_amount': 0.0,
            'not_yet_invoiced': 0.0,
            'remaining': 1000.0,
        }])

        order = self.env['sale.order'].create({
            'company_id': self.company.id,
            'partner_id': declaration.partner_id.id,
            'commitment_date': declaration.start_date,
            'pricelist_id': self.pricelist.id,
            'l10n_it_edi_doi_declaration_of_intent_id': declaration.id,
            'order_line': [
                Command.create({
                    'name': 'declaration line',
                    'product_id': self.product_1.id,
                    'price_unit': 1000.0,  # == declaration.threshold
                    'tax_id': [Command.set(declaration_tax.ids)],
                }),
            ]
        })
        self.assertEqual(order.l10n_it_edi_doi_warning, "")

        order_form = Form(order)
        with order_form.order_line.edit(0) as line_form:
            line_form.price_unit = 2000
            line_form.save()
            self.assertEqual(
                order_form.l10n_it_edi_doi_warning,
                "Pay attention, the threshold of your Declaration of Intent test 2019-threshold 1000 of 1,000.00\xa0€ is exceeded by 1,000.00\xa0€, this document included.\n"
                "Invoiced: 0.00\xa0€; Not Yet Invoiced: 2,000.00\xa0€"
            )
        order_form.save()

        order.action_confirm()
        # unchanged warning
        self.assertEqual(
            order.l10n_it_edi_doi_warning,
            "Pay attention, the threshold of your Declaration of Intent test 2019-threshold 1000 of 1,000.00\xa0€ is exceeded by 1,000.00\xa0€, this document included.\n"
            "Invoiced: 0.00\xa0€; Not Yet Invoiced: 2,000.00\xa0€"
        )
        with order_form.order_line.edit(0) as line_form:
            line_form.price_unit = 3000
            line_form.save()
            self.assertEqual(
                order_form.l10n_it_edi_doi_warning,
                "Pay attention, the threshold of your Declaration of Intent test 2019-threshold 1000 of 1,000.00\xa0€ is exceeded by 2,000.00\xa0€, this document included.\n"
                "Invoiced: 0.00\xa0€; Not Yet Invoiced: 3,000.00\xa0€"
            )

    def test_invoice(self):
        """
        Ensure the amounts and warnings are computed correctly in the following flow:
        We create a single invoice and post it.
        """
        declaration = self.declaration_1000
        declaration_tax = declaration.company_id.l10n_it_edi_doi_declaration_of_intent_tax

        self.assertRecordValues(declaration, [{
            'invoiced': 0.0,
            'draft_amount': 0.0,
            'not_yet_invoiced': 0.0,
            'remaining': 1000.0,
        }])

        invoice = self.env['account.move'].create({
            'move_type': 'out_invoice',
            'company_id': self.company.id,
            'partner_id': declaration.partner_id.id,
            'invoice_date': declaration.start_date,
            'l10n_it_edi_doi_declaration_of_intent_id': declaration.id,
            'invoice_line_ids': [
                Command.create({
                    'name': 'declaration line',
                    'quantity': 1,
                    'price_unit': 1000.0,  # == declaration.threshold
                    'tax_ids': [Command.set(declaration_tax.ids)],
                }),
                Command.create({
                    # The line should be ignored since it does not use the special tax
                    'name': 'not a declaration line',
                    'quantity': 1,
                    'price_unit': 2000.0,  # > declaration.threshold; not counted
                    'tax_ids': False,
                }),
            ],
        })
        self.assertRecordValues(declaration, [{
            'invoiced': 0.0,
            'draft_amount': 1000.0,
            'not_yet_invoiced': 0.0,
            'remaining': 1000.0,
        }])
        # There is no warning since posting the invoice would not exceed the threshold.
        # (only lines with the special tax are counted)
        self.assertEqual(invoice.l10n_it_edi_doi_warning, "")

        # Update the declaration part of the invoice to exceed the threshold
        invoice.invoice_line_ids[0].price_unit = 2000  # > declaration.threshold
        # The warning appears with the amount after posting the invoice.
        self.assertEqual(
            invoice.l10n_it_edi_doi_warning,
            "Pay attention, the threshold of your Declaration of Intent test 2019-threshold 1000 of 1,000.00\xa0€ is exceeded by 1,000.00\xa0€, this document included.\n"
            "Invoiced: 2,000.00\xa0€; Not Yet Invoiced: 0.00\xa0€"
        )

        invoice.action_post()
        self.assertRecordValues(declaration, [{
            'invoiced': 2000.0,
            'draft_amount': 0.0,
            'not_yet_invoiced': 0.0,
            'remaining': -1000.0,
        }])
        self.assertEqual(
            invoice.l10n_it_edi_doi_warning,
            "Pay attention, the threshold of your Declaration of Intent test 2019-threshold 1000 of 1,000.00\xa0€ is exceeded by 1,000.00\xa0€, this document included.\n"
            "Invoiced: 2,000.00\xa0€; Not Yet Invoiced: 0.00\xa0€"
        )

    def test_sale_order_and_independent_invoice(self):
        """
        Ensure the amounts and warnings are computed correctly in the following flow:
          * We create a quotation and confirm it to sales order.
          * Then we create a single invoice independent of the sales order and post it.
            I.e. the invoice should not influence the Not Yet Invoiced amount of the declaration.
        """
        declaration = self.declaration_1000
        declaration_tax = declaration.company_id.l10n_it_edi_doi_declaration_of_intent_tax

        order = self.env['sale.order'].create({
            'company_id': self.company.id,
            'partner_id': declaration.partner_id.id,
            'commitment_date': declaration.start_date,
            'pricelist_id': self.pricelist.id,
            'l10n_it_edi_doi_declaration_of_intent_id': declaration.id,
            'order_line': [
                Command.create({
                    'name': 'declaration line',
                    'product_id': self.product_1.id,
                    'price_unit': 1000.0,  # == declaration.threshold
                    'tax_id': [Command.set(declaration_tax.ids)],
                }),
                Command.create({
                    'name': 'not a declaration line',
                    'product_id': self.product_1.id,
                    'price_unit': 2000.0,  # > declaration.threshold; not counted
                    'tax_id': False,
                }),
            ]
        })

        # There is no warning since confirming the sale order would not exceed the threshold.
        # (only lines with the special tax are counted)
        self.assertEqual(order.l10n_it_edi_doi_warning, "")

        # We only count sales orders not quotations
        self.assertRecordValues(declaration, [{
            'invoiced': 0.0,
            'draft_amount': 0.0,
            'not_yet_invoiced': 0.0,
            'remaining': 1000.0,
        }])

        # Update the declaration part of the invoice to exceed the threshold
        order.order_line[0].price_unit = 2000  # > declaration.threshold
        # Now we show the warning
        self.assertEqual(
            order.l10n_it_edi_doi_warning,
            "Pay attention, the threshold of your Declaration of Intent test 2019-threshold 1000 of 1,000.00\xa0€ is exceeded by 1,000.00\xa0€, this document included.\n"
            "Invoiced: 0.00\xa0€; Not Yet Invoiced: 2,000.00\xa0€"
        )

        order.action_confirm()
        self.assertRecordValues(declaration, [{
            'invoiced': 0.0,
            'draft_amount': 0.0,
            'not_yet_invoiced': 2000.0,
            'remaining': -1000.0,
        }])

        invoice = self.env['account.move'].create({
            'move_type': 'out_invoice',
            'l10n_it_edi_doi_declaration_of_intent_id': declaration.id,
            'company_id': self.company.id,
            'partner_id': declaration.partner_id.id,
            'invoice_date': declaration.start_date,
            'invoice_line_ids': [
                Command.create({
                    'name': 'declaration line',
                    'quantity': 1,
                    'price_unit': 1000.0,
                    'tax_ids': [Command.set(declaration_tax.ids)],
                }),
                Command.create({
                    # The line should be ignored since it does not use the special tax
                    'name': 'none declaration line',
                    'quantity': 1,
                    'price_unit': 2000.0,  # > declaration.threshold; not counted
                    'tax_ids': False,
                }),
            ],
        })
        self.assertRecordValues(declaration, [{
            'invoiced': 0.0,
            'draft_amount': 1000.0,
            'not_yet_invoiced': 2000.0,  # 2000 "base"
            'remaining': -1000.0,
        }])

        self.assertEqual(
            invoice.l10n_it_edi_doi_warning,
            "Pay attention, the threshold of your Declaration of Intent test 2019-threshold 1000 of 1,000.00\xa0€ is exceeded by 2,000.00\xa0€, this document included.\n"
            "Invoiced: 1,000.00\xa0€; Not Yet Invoiced: 2,000.00\xa0€"
        )

        invoice.action_post()
        self.assertRecordValues(declaration, [{
            'invoiced': 1000.0,
            'draft_amount': 0.0,
            'not_yet_invoiced': 2000.0,
            'remaining': -2000.0,
        }])

    @freeze_time('2019-12-31')  # declaration.end_date
    def test_overinvoiced_sale_order_and_credit_note(self):
        """
        Ensure the amounts and warnings are computed correctly in the following flow:
          * We create a quotation and confirm it to sales order.
          * Then we invoice the sales order in 2 downpayment invoices of 50% each.
            I.e. the Invoiced amount should be transferred correctly from Not Yet Invoiced to Invoiced
          * We increase the amount on one of the invoices s.t. it exceeds the sales order amount.
            I.e. the Invoiced amount increases more than the Not Yet Invoiced amount is lowered
          * We reverse the invoice exceeding the sales order amount by creating a credit note.
            I.e. check the amounts are computed correctly on the warning.
        """

        declaration = self.declaration_1000
        declaration_tax = declaration.company_id.l10n_it_edi_doi_declaration_of_intent_tax

        # Add an order that is not used in the rest of this test.
        # This way we can always show the warning and that this amount will not be removed from Not Yet Invoiced.
        independent_order = self.env['sale.order'].create({
            'company_id': self.company.id,
            'partner_id': declaration.partner_id.id,
            'commitment_date': declaration.start_date,
            'pricelist_id': self.pricelist.id,
            'l10n_it_edi_doi_declaration_of_intent_id': declaration.id,
            'order_line': [
                Command.create({
                    'name': 'declaration line',
                    'product_id': self.product_1.id,
                    'price_unit': 2000.0,  # > declaration.threshold
                    'tax_id': [Command.set(declaration_tax.ids)],
                }),
                Command.create({
                    'name': 'not a declaration line',
                    'product_id': self.product_1.id,
                    'price_unit': 2000.0,  # > declaration.threshold; not counted
                    'tax_id': False,
                }),
            ]
        })
        independent_order.action_confirm()
        self.assertRecordValues(declaration, [{
            'invoiced': 0.0,
            'draft_amount': 0.0,
            'not_yet_invoiced': 2000.0,  # 2000 "base" from independent_order
            'remaining': -1000.0,
        }])

        order = self.env['sale.order'].create({
            'company_id': self.company.id,
            'partner_id': declaration.partner_id.id,
            'commitment_date': declaration.start_date,
            'pricelist_id': self.pricelist.id,
            'l10n_it_edi_doi_declaration_of_intent_id': declaration.id,
            'order_line': [
                Command.create({
                    'name': 'declaration line',
                    'product_id': self.product_1.id,
                    'price_unit': 1000.0,  # == declaration.threshold
                    'tax_id': [Command.set(declaration_tax.ids)],
                }),
                Command.create({
                    'name': 'not a declaration line',
                    'product_id': self.product_1.id,
                    'price_unit': 2000.0,  # > declaration.threshold; not counted
                    'tax_id': False,
                }),
            ]
        })
        order.action_confirm()
        self.assertRecordValues(declaration, [{
            'invoiced': 0.0,
            'draft_amount': 0.0,
            'not_yet_invoiced': 3000.0,  # 2000 "base" + 1000 from `order`
            'remaining': -2000.0,
        }])

        for i in range(2):
            self.env['sale.advance.payment.inv'].with_context({
                   'active_model': 'sale.order',
                   'active_ids': [order.id],
                   'active_id': order.id,
                   'default_journal_id': self.company_data_2['default_journal_sale'].id,
               }).create({
                   'advance_payment_method': 'percentage',
                   'amount': 50,
                   'deposit_account_id': self.company_data_2['default_account_revenue'].id,
               }).create_invoices()
        # The amount of both draft invoices is moved to draft_amount.
        self.assertRecordValues(declaration, [{
            'invoiced': 0.0,
            'draft_amount': 1000.0,  # 2 * 500 from the invoices
            'not_yet_invoiced': 2000.0,  # 2000 "base"
            'remaining': -1000.0,
        }])

        invoice = order.invoice_ids[0]
        self.assertEqual(
            invoice.l10n_it_edi_doi_warning,
            "Pay attention, the threshold of your Declaration of Intent test 2019-threshold 1000 of 1,000.00\xa0€ is exceeded by 1,500.00\xa0€, this document included.\n"
            "Invoiced: 500.00\xa0€; Not Yet Invoiced: 2,000.00\xa0€"
        )

        invoice.invoice_line_ids[0].price_unit = 2000  # 1000 more than the sales order declaration amount
        self.assertEqual(
            invoice.l10n_it_edi_doi_warning,
            "Pay attention, the threshold of your Declaration of Intent test 2019-threshold 1000 of 1,000.00\xa0€ is exceeded by 3,000.00\xa0€, this document included.\n"
            "Invoiced: 2,000.00\xa0€; Not Yet Invoiced: 2,000.00\xa0€"
        )
        invoice.action_post()
        self.assertRecordValues(declaration, [{
            'invoiced': 2000.0,  # 2000 from invoice
            'draft_amount': 500.0,  # 500 from invoice2
            'not_yet_invoiced': 2000.0,  # 2000 "base"
            'remaining': -3000.0,
        }])

        invoice2 = order.invoice_ids[1]
        invoice2.action_post()
        self.assertEqual(
            invoice2.l10n_it_edi_doi_warning,
            "Pay attention, the threshold of your Declaration of Intent test 2019-threshold 1000 of 1,000.00\xa0€ is exceeded by 3,500.00\xa0€, this document included.\n"
            "Invoiced: 2,500.00\xa0€; Not Yet Invoiced: 2,000.00\xa0€"
        )
        self.assertRecordValues(declaration, [{
            'invoiced': 2500.0,  # 2000 + 500 from the 2 downpayment invoices
            'draft_amount': 0.0,
            'not_yet_invoiced': 2000.0,  # 2000 "base"
            'remaining': -3500.0,
        }])

        # Reverse the invoice via a credit note
        self.env['account.move.reversal'].with_company(self.company).create(
            {
                'move_ids': [Command.set((invoice.id,))],
                'date': '2019-12-31',
                'journal_id': invoice.journal_id.id,
            }
        ).reverse_moves()

        # The invoice we reversed invoiced more than the sales order amount.
        credit_note = invoice.reversal_move_id
        self.assertEqual(
            credit_note.l10n_it_edi_doi_warning,
            "Pay attention, the threshold of your Declaration of Intent test 2019-threshold 1000 of 1,000.00\xa0€ is exceeded by 2,000.00\xa0€, this document included.\n"
            "Invoiced: 500.00\xa0€; Not Yet Invoiced: 2,500.00\xa0€"
        )

        credit_note.action_post()
        self.assertRecordValues(declaration, [{
            'invoiced': 500,  # 1 downpayment of 50% on 1000 sale order
            'draft_amount': 0,
            'not_yet_invoiced': 2500,  # 2000 ("base") + 500 (left on sale order)
            'remaining': -2000,
        }])

    @freeze_time('2019-12-31')  # declaration.end_date
    def test_consolidated_billing(self):
        """
        Ensure the amounts and warnings are computed correctly in the following flow:
          * We create multiple quotations with 1 line each and confirm them all to sales order.
          * We create a single invoice for the SOs from the previous step.
            There is one line per SO.
          * We change the amount on the one of the lines of the invoice.
        I.e. we check that there is no "not yet invoiced" amount on the SO left despite of the price_unit change.
        """

        declaration = self.declaration_1000
        declaration_tax = declaration.company_id.l10n_it_edi_doi_declaration_of_intent_tax

        orders = self.env['sale.order'].create([{
            'company_id': self.company.id,
            'partner_id': declaration.partner_id.id,
            'commitment_date': declaration.start_date,
            'pricelist_id': self.pricelist.id,
            'l10n_it_edi_doi_declaration_of_intent_id': declaration.id,
            'order_line': [
                Command.create({
                    'name': 'declaration line',
                    'product_id': self.product_1.id,
                    'price_unit': 2000.0,  # > declaration.threshold
                    'tax_id': [Command.set(declaration_tax.ids)],
                }),
            ]
        } for i in range(3)])
        orders.action_confirm()
        self.assertRecordValues(declaration, [{
            'invoiced': 0.0,
            'draft_amount': 0.0,
            'not_yet_invoiced': 6000.0,
            'remaining': -5000.0,
        }])

        invoice = orders._create_invoices()
        # The draft amount gets added to "not_yet_invoiced"
        self.assertRecordValues(declaration, [{
            'invoiced': 0.0,
            'draft_amount': 6000.0,
            'not_yet_invoiced': 0.0,
            'remaining': 1000.0,
        }])
        self.assertEqual(
            invoice.l10n_it_edi_doi_warning,
            "Pay attention, the threshold of your Declaration of Intent test 2019-threshold 1000 of 1,000.00\xa0€ is exceeded by 5,000.00\xa0€, this document included.\n"
            "Invoiced: 6,000.00\xa0€; Not Yet Invoiced: 0.00\xa0€"
        )

        invoice.invoice_line_ids[0].price_unit = 1000
        # The sale order line linke to the edited line is still considered invoiced, since the quantities match.
        self.assertEqual(
            invoice.l10n_it_edi_doi_warning,
            "Pay attention, the threshold of your Declaration of Intent test 2019-threshold 1000 of 1,000.00\xa0€ is exceeded by 4,000.00\xa0€, this document included.\n"
            "Invoiced: 5,000.00\xa0€; Not Yet Invoiced: 0.00\xa0€"
        )
        self.assertRecordValues(declaration, [{
            'invoiced': 0.0,
            'draft_amount': 5000.0,
            'not_yet_invoiced': 0.0,
            'remaining': 1000.0,
        }])

        invoice.action_post()
        self.assertRecordValues(declaration, [{
            'invoiced': 5000.0,
            'draft_amount': 0.0,
            'not_yet_invoiced': 0.0,
            'remaining': -4000.0,
        }])
