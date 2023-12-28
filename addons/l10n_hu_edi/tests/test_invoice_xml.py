from odoo import tools
from odoo.tests.common import tagged
from odoo.addons.l10n_hu_edi.tests.common import L10nHuEdiTestCommon

from freezegun import freeze_time


@tagged("post_install_l10n", "-at_install", "post_install")
class L10nHuEdiTestInvoiceXml(L10nHuEdiTestCommon):
    @classmethod
    def setUpClass(cls, chart_template_ref="l10n_hu.hungarian_chart_template", edi_format_ref="l10n_hu_edi.edi_hun_nav_3_0"):
        with freeze_time("2024-02-01"):
            super().setUpClass(chart_template_ref=chart_template_ref, edi_format_ref=edi_format_ref)

    def test_invoice_and_credit_note(self):
        with freeze_time("2024-02-01"):
            invoice = self.create_invoice_simple()
            invoice.action_post()
            invoice_xml = invoice.l10n_hu_edi_active_transaction_id.attachment_id.raw

            with tools.file_open("l10n_hu_edi/tests/invoice_xmls/invoice_simple.xml", "rb") as expected_xml_file:
                self.assertXmlTreeEqual(
                    self.get_xml_tree_from_string(invoice_xml),
                    self.get_xml_tree_from_string(expected_xml_file.read()),
                )

            credit_note = self.create_reversal(invoice)
            credit_note.action_post()
            credit_note_xml = credit_note.l10n_hu_edi_active_transaction_id.attachment_id.raw

            with tools.file_open("l10n_hu_edi/tests/invoice_xmls/credit_note.xml", "rb") as expected_xml_file:
                self.assertXmlTreeEqual(
                    self.get_xml_tree_from_string(credit_note_xml),
                    self.get_xml_tree_from_string(expected_xml_file.read()),
                )

    def test_invoice_complex_huf(self):
        with freeze_time("2024-02-01"):
            invoice = self.create_invoice_complex_huf()
            invoice.action_post()

            invoice_xml = invoice.l10n_hu_edi_active_transaction_id.attachment_id.raw
            with tools.file_open("l10n_hu_edi/tests/invoice_xmls/invoice_complex_huf.xml", "rb") as expected_xml_file:
                self.assertXmlTreeEqual(
                    self.get_xml_tree_from_string(invoice_xml),
                    self.get_xml_tree_from_string(expected_xml_file.read()),
                )

    def test_invoice_complex_eur(self):
        with freeze_time("2024-02-01"):
            invoice = self.create_invoice_complex_eur()
            invoice.action_post()

            invoice_xml = invoice.l10n_hu_edi_active_transaction_id.attachment_id.raw
            with tools.file_open("l10n_hu_edi/tests/invoice_xmls/invoice_complex_eur.xml", "rb") as expected_xml_file:
                self.assertXmlTreeEqual(
                    self.get_xml_tree_from_string(invoice_xml),
                    self.get_xml_tree_from_string(expected_xml_file.read()),
                )
