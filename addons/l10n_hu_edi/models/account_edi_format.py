# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, _
import time

from markupsafe import Markup


class AccountEdiFormat(models.Model):
    _inherit = "account.edi.format"

    # -------------------------------------------------------------------------
    # BUSINESS FLOW: EDI
    # -------------------------------------------------------------------------

    def _needs_web_services(self):
        # EXTENDS account_edi
        self.ensure_one()
        return self.code == "hun_nav_3_0" or super()._needs_web_services()

    def _is_compatible_with_journal(self, journal):
        # EXTENDS account_edi
        self.ensure_one()
        if self.code != "hun_nav_3_0":
            return super()._is_compatible_with_journal(journal)
        return journal.type == "sale" and journal.country_code == "HU"

    def _is_enabled_by_default_on_journal(self, journal):
        # EXTENDS account_edi
        self.ensure_one()
        if self.code == "hun_nav_3_0":
            return journal.type == "sale" and journal.country_code == "HU"
        return super()._is_enabled_by_default_on_journal(journal)

    def _check_move_configuration(self, move):
        # EXTENDS account_edi
        self.ensure_one()
        if self.code != "hun_nav_3_0":
            return super()._check_move_configuration(move)

        return move._l10n_hu_edi_check_invoice_for_errors()

    def _get_move_applicability(self, move):
        # EXTENDS account_edi
        self.ensure_one()
        if self.code != "hun_nav_3_0":
            return super()._get_move_applicability(move)

        # Determine on which invoices the EDI must be generated.
        if move.country_code == "HU" and move.move_type in ("out_invoice", "out_refund"):
            return {
                "post": self._l10n_hu_edi_post_invoice,
                "edi_content": self._l10n_hu_edi_generate_xml,
            }

    def _l10n_hu_edi_generate_xml(self, move):
        return move._l10n_hu_edi_generate_xml()

    def _l10n_hu_edi_post_invoice(self, invoice):
        transaction = invoice.l10n_hu_edi_active_transaction_id

        if transaction.state in ["to_send", "token_error"]:
            res_step_1 = self._l10n_hu_post_invoice_step_1(invoice)

            if transaction.state == "sent":
                time.sleep(5)
            else:
                return {invoice: res_step_1}

        if transaction.state in ["sent", "query_error"]:
            return {invoice: self._l10n_hu_post_invoice_step_2(invoice)}

    def _l10n_hu_post_invoice_step_1(self, invoice):
        transaction = invoice.l10n_hu_edi_active_transaction_id
        transaction.upload()

        if transaction.state == "token_error":
            main_message = _("Could not authenticate with NAV. Check your credentials and try again.")
            result = {"error": main_message, "blocking_level": "error"}

        elif transaction.state == "sent":
            main_message = _("Invoice submission succeeded. Waiting for answer.")
            result = {"attachment": transaction.attachment_id}

        elif transaction.state == "send_error":
            main_message = _("Invoice submission failed. Reset to draft and re-send.")
            result = {"error": main_message, "blocking_level": "warning"}

        elif transaction.state == "send_timeout":
            main_message = _("Invoice submission timed out. Please log in to the NAV portal to check whether the invoice was accepted.")
            result = {"error": main_message, "blocking_level": "warning"}

        message = main_message + (Markup("<br/>") + transaction.error_message if transaction.error_message else '')
        invoice.with_context(no_new_invoice=True).message_post(body=message)
        return result

    def _l10n_hu_post_invoice_step_2(self, invoice):
        """Download the response from NAV."""
        transaction = invoice.l10n_hu_edi_active_transaction_id
        transaction.query_status()

        if transaction.state == "confirmed":
            main_message = _("The invoice was successfully accepted by the NAV.")
            result = {"success": True}

        elif transaction.state == "confirmed_warning":
            main_message = _("The invoice was accepted by the NAV, but warnings were reported. To reverse, create a credit note.")
            result = {"error": main_message, "blocking_level": "warning"}
            # This is a hack so that the EDI document appears in the "sent" state, but the warning also appears
            invoice._get_edi_document(self).write({"state": "sent"})

        elif transaction.state == "rejected":
            main_message = _("The invoice was rejected by the NAV. Reset to draft and re-send.")
            result = {"error": main_message, "blocking_level": "warning"}
            # This is a hack so that the EDI document appears in the "sent" state, but the warning also appears
            invoice._get_edi_document(self).write({"state": "sent"})

        elif transaction.state == "query_error":
            main_message = _("There was an error while querying the invoice's status from NAV.")
            result = {"error": main_message, "blocking_level": "error"}

        message = main_message + (Markup("<br/>") + transaction.error_message if transaction.error_message else '')
        invoice.with_context(no_new_invoice=True).message_post(body=message)
        return result
