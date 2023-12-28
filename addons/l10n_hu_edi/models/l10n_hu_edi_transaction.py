# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, _
from odoo.exceptions import UserError
from odoo.addons.l10n_hu_edi.models.l10n_hu_edi_connection import L10nHuEdiError

import logging

_logger = logging.getLogger(__name__)

# Active transactions are in states that can still potentially lead to "Confirmed" or "Confirmed with Warnings".
# "Confirmed" and "Confirmed with Warnings" are particular in that they lock the invoice number on NAV's side,
# so any new transaction with the same invoice number will be rejected by NAV.
# Thus, we need to be careful about what operations we do on invoices with an active transaction.
# New transactions typically start out as active, but may end up being inactive if an error occurs
# or they are aborted. However, an inactive transaction will stay inactive forever.
_ACTIVE_STATES = ["to_send", "token_error", "sent", "send_timeout", "confirmed", "confirmed_warning", "query_error"]


def statemachine(start_states, end_states):
    """ Decorator to help flag unintended state transitions.
    Any unintended start state will cause a UserError to be raised,
    any unintended end state will be logged as an error.
    """
    def decorate(fn):
        def decorated_fn(transactions, *args, **kwargs):
            if any(t.state not in start_states for t in transactions):
                raise UserError(_("Method %s called with bad start state(s): %s, allowed states are %s", fn.__name__, transactions.mapped("state"), start_states))
            fn(transactions, *args, **kwargs)
            if any(t.state not in end_states for t in transactions):
                _logger.error(_("Method %s returned with bad end state(s): %s, allowed states are %s", fn.__name__, transactions.mapped("state"), end_states))
        return decorated_fn
    return decorate


class L10nHuEdiTransaction(models.Model):
    _name = "l10n_hu_edi.transaction"
    _description = "Hungarian Tax Authority Invoice Upload Transaction"
    _order = "create_date"
    _rec_name = "id"

    #################################################################################################
    # STATE DIAGRAM:
    # to_send, token_error --[upload]--> token_error, sent, send_error, send_timeout
    # to_send, token_error --[abort]--> unsent
    # sent, query_error --[query_status]--> sent, confirmed, confirmed_warning, rejected, query_error
    # send_error: is a final state due to recording requirements (to retry, create a new transaction)
    # send_timeout: should be recoverable, but not implemented yet
    # confirmed, confirmed_warning, rejected: are final states
    #################################################################################################
    state = fields.Selection(
        selection=[
            ("unsent", "Unsent (aborted)"),
            ("to_send", "To Send"),
            ("token_error", "To Retry, could not get an authentication token"),
            ("sent", "Sent, waiting for response"),
            ("send_error", "Error when sending"),
            ("send_timeout", "Timeout when sending"),
            ("confirmed", "Confirmed"),
            ("confirmed_warning", "Confirmed with warnings"),
            ("rejected", "Rejected"),
            ("query_error", "To Retry, error when requesting status"),
        ],
        string="Status",
        required=True,
        copy=False,
        default="to_send",
        index="btree_not_null",
    )
    credentials_id = fields.Many2one(
        comodel_name="l10n_hu_edi.credentials",
        string="Credentials",
        required=True,
        ondelete="restrict",
    )
    invoice_id = fields.Many2one(
        comodel_name="account.move",
        string="Invoice",
        required=True,
        index="btree_not_null",
        ondelete="restrict",
    )
    index = fields.Integer(
        string="Index of invoice within a batch upload",
    )
    operation = fields.Selection(
        selection=[
            ("CREATE", "Create"),
            ("MODIFY", "Modify"),
        ],
        string="Upload invoice operation type",
    )
    attachment_id = fields.Many2one(
        comodel_name="ir.attachment",
        string="Invoice XML to upload",
        required=True,
        ondelete="restrict",
        copy=False,
    )
    send_time = fields.Datetime(
        string="Invoice upload time",
        copy=False,
    )
    transaction_code = fields.Char(
        string="Transaction Code",
        index="trigram",
        copy=False,
    )
    error_message = fields.Text(
        string="Transaction error details",
        copy=False,
    )
    credentials_mode = fields.Selection(
        related="credentials_id.mode"
    )


    # === State transitions === #

    @statemachine(start_states=("to_send", "token_error"), end_states=("token_error", "sent", "send_error", "send_timeout"))
    def upload(self):
        """ Sends the xml to NAV."""
        # == Upload ==
        for i, transaction in enumerate(self, start=1):
            transaction.index = i

        invoice_operations = [
            {
                "index": transaction.index,
                "operation": transaction.operation,
                "invoice_data": transaction.attachment_id.raw,
            }
            for transaction in self
        ]

        try:
            token_result = self.env["l10n_hu_edi.connection"].do_token_exchange(self.credentials_id)
        except L10nHuEdiError as e:
            return self.write({
                "state": "token_error",
                "error_message": str(e),
            })

        self.write({"send_time": fields.Datetime.now()})

        try:
            transaction_code = self.env["l10n_hu_edi.connection"].do_manage_invoice(self.credentials_id, token_result["token"], invoice_operations)
        except L10nHuEdiError as e:
            return self.write({
                "state": "send_timeout" if e.code == "timeout" else "send_error",
                "error_message": str(e),
            })

        self.write({
            "state": "sent",
            "transaction_code": transaction_code,
        })

    @statemachine(start_states=("to_send", "token_error"), end_states=("unsent"))
    def abort(self):
        """ Mark the transaction as aborted, so it will not be retried. """
        self.write({"state": "unsent"})

    @statemachine(start_states=("sent", "query_error"), end_states=("sent", "confirmed", "confirmed_warning", "rejected", "query_error"))
    def query_status(self):
        """ Check NAV's invoice status."""
        # We should update all transactions with the same transaction code at once.
        self |= self.search([
            ("transaction_code", "in", self.mapped("transaction_code")),
            ("state", "in", ["sent", "query_error"]),
        ])

        for transaction_code in set(self.mapped("transaction_code")):
            self.filtered(lambda t: t.transaction_code == transaction_code)._query_status_single()

    @statemachine(start_states=("sent", "query_error"), end_states=("sent", "confirmed", "confirmed_warning", "rejected", "query_error"))
    def _query_status_single(self):
        """ Check NAV's invoice status for several invoices that share the same transaction code
        (i.e. they were uploaded in a single batch).
        """
        transaction_codes = set(self.mapped("transaction_code"))
        if False in transaction_codes or len(transaction_codes) != 1:
            raise UserError("All transactions queried together must share the same transaction code!")

        try:
            invoices_results = self.env["l10n_hu_edi.connection"].do_query_transaction_status(self.credentials_id, self[0].transaction_code)
        except L10nHuEdiError as e:
            return self.write({
                "state": "query_error",
                "error_message": str(e),
            })

        for invoice_result in invoices_results:
            transaction = self.filtered(lambda t: str(t.index) == invoice_result["index"])
            if not transaction:
                _logger.error(_("Could not match NAV transaction_code %s, index %s to a transaction in Odoo", self[0].transaction_code, invoice_result["index"]))
                continue

            if invoice_result["invoice_status"] in ["RECEIVED", "PROCESSING", "SAVED"]:
                # The invoice has not been processed yet, so stay in state="sent".
                pass

            elif invoice_result["invoice_status"] == "DONE":
                if not invoice_result["business_validation_messages"] and not invoice_result["technical_validation_messages"]:
                    transaction.write({"state": "confirmed"})
                else:
                    transaction.write({
                        "state": "confirmed_warning",
                        "error_message": self._generate_validation_message(invoice_result),
                    })

            elif invoice_result["invoice_status"] == "ABORTED":
                transaction.write({
                    "state": "rejected",
                    "error_message": self._generate_validation_message(invoice_result),
                })

            else:
                transaction.write({
                    "state": "query_error",
                    "error_message": _("NAV returned a non-standard invoice status: %s", invoice_result["invoice_status"]),
                })

    def unlink(self):
        if "production" in self.mapped("credentials_id").mapped("mode"):
            raise UserError(_("Cannot delete transactions in production mode!"))
        return super().unlink()

    # === Helpers === #

    def _generate_validation_message(self, invoice_result):
        messages = []
        if invoice_result.get("business_validation_messages"):
            messages.append(_("Business Validation Messages:"))
        for message in invoice_result.get("business_validation_messages", []):
            messages.append(f"{message['validation_result_code']}: {message['validation_error_code']} ({message['message']})")

        if invoice_result.get("technical_validation_messages"):
            messages.append(_("Technical Validation Messages:"))
        for message in invoice_result.get("technical_validation_messages", []):
            messages.append(f"{message['validation_result_code']}: {message['validation_error_code']} ({message['message']})")

        return "\n".join(messages)
