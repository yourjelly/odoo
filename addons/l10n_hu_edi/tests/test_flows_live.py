from odoo import tools
from odoo.tests.common import tagged
from odoo.addons.l10n_hu_edi.tests.common import L10nHuEdiTestCommon

from unittest import skipIf
import contextlib

TEST_CRED = {}
last_invoice = {"INV/2024/": 20, "RINV/2024/": 12}
with contextlib.suppress(ImportError):
    from .credentials import TEST_CRED, last_invoice


@tagged("external_l10n", "post_install", "-at_install", "-standard", "external")
@skipIf(not TEST_CRED, "no NAV credentials")
class L10nHuEdiTestFlowsLive(L10nHuEdiTestCommon):
    """
    Test the Hungarian EDI flows with the NAV test servers:
        - sending of an invoice
        - sending of an credit note.
    """
    @classmethod
    def setUpClass(cls, chart_template_ref="l10n_hu.hungarian_chart_template", edi_format_ref="l10n_hu_edi.edi_hun_nav_3_0"):
        super().setUpClass(chart_template_ref=chart_template_ref, edi_format_ref=edi_format_ref)

    @classmethod
    def create_edi_credentials(cls):
        # OVERRIDE
        return cls.env["l10n_hu_edi.credentials"].with_context(nav_comm_debug=True).create([
            {
                "company_id": cls.company_data["company"].id,
                **TEST_CRED,
            }
        ])

    @contextlib.contextmanager
    def set_invoice_name(self, invoice, prefix):
        try:
            last_invoice[prefix] = last_invoice.get(prefix, 0) + 1
            invoice.name = f"{prefix}{last_invoice[prefix]:05}"
            yield
        finally:
            if invoice.l10n_hu_edi_active_transaction_id.state not in ["confirmed", "confirmed_warning"]:
                last_invoice[prefix] -= 1
            else:
                with tools.file_open("l10n_hu_edi/tests/credentials.py", "a") as credentials_file:
                    credentials_file.write(f"last_invoice = {last_invoice}\n")


    def test_send_invoice_and_credit_note(self):
        # Note: If the NAV returns an error, this may be because an invoice
        # or credit note with this name already exist. In this case, you need
        # to rename them.

        invoice = self.create_invoice_simple()
        with self.set_invoice_name(invoice, "INV/2024/"):
            invoice.action_post()
            invoice.with_context(nav_comm_debug=True).action_process_edi_web_services(with_commit=False)
            self.assertRecordValues(invoice.edi_document_ids, [{"error": False}])
            self.assertRecordValues(invoice.l10n_hu_edi_active_transaction_id, [{"state": "confirmed"}])
            self.assertRecordValues(invoice, [{"edi_state": "sent"}])

        credit_note = self.create_reversal(invoice)
        with self.set_invoice_name(credit_note, "RINV/2024/"):
            credit_note.action_post()
            credit_note.with_context(nav_comm_debug=True).action_process_edi_web_services(with_commit=False)
            self.assertRecordValues(credit_note.edi_document_ids, [{"error": False}])
            self.assertRecordValues(credit_note.l10n_hu_edi_active_transaction_id, [{"state": "confirmed"}])
            self.assertRecordValues(invoice, [{"edi_state": "sent"}])

    def test_send_invoice_complex_huf(self):
        # Note: If the NAV returns an error, this may be because an invoice
        # with this name already exist. In this case, you need to rename it.

        invoice = self.create_invoice_complex_huf()
        with self.set_invoice_name(invoice, "INV/2024/"):
            invoice.action_post()
            invoice.with_context(nav_comm_debug=True).action_process_edi_web_services(with_commit=False)
            self.assertRecordValues(invoice.edi_document_ids, [{"error": False}])
            self.assertRecordValues(invoice.l10n_hu_edi_active_transaction_id, [{"state": "confirmed"}])
            self.assertRecordValues(invoice, [{"edi_state": "sent"}])

    def test_send_invoice_complex_eur(self):
        # Note: If the NAV returns an error, this may be because an invoice
        # with this name already exist. In this case, you need to rename it.

        invoice = self.create_invoice_complex_eur()
        with self.set_invoice_name(invoice, "INV/2024/"):
            invoice.action_post()
            invoice.with_context(nav_comm_debug=True).action_process_edi_web_services(with_commit=False)
            self.assertRecordValues(invoice.edi_document_ids, [{"error": False}])
            self.assertRecordValues(invoice.l10n_hu_edi_active_transaction_id, [{"state": "confirmed"}])
            self.assertRecordValues(invoice, [{"edi_state": "sent"}])
