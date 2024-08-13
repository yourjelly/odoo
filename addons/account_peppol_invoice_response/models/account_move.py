#!/usr/bin/env python3

from odoo import api, fields, models, _
from odoo.exceptions import UserError


response_codes = {
    'AB': 'Message acknowledgement',  # Indicates that an acknowledgement relating to receipt of message or transaction is required. Status is used when Buyer has received a readable invoice message that can be understood and submitted for processing by the Buyer.
    'AP': 'Accepted',                 # Indication that the referenced offer or transaction (e.g., cargo booking or quotation request) has been accepted. Status is used only when the Buyer has given a final approval of the invoice and the next step is payment
    'RE': 'Rejected',                 # Indication that the referenced offer or transaction (e.g., cargo booking or quotation request) is not accepted. Status is used only when the Buyer will not process the referenced Invoice any further. Buyer is rejecting this invoice but not necessarily the commercial transaction. Although it can be used also for rejection for commercial reasons (invoice not corresponding to delivery).
    'IP': 'In process',               # Indicates that the referenced message or transaction is being processed. Status is used when the processing of the Invoice has started in Buyers system.
    'UQ': 'Under query',              # Indicates that the processing of the referenced message has been halted pending response to a query. Status is used when Buyer will not proceed to accept the Invoice without receiving additional information from the Seller.
    'CA': 'Conditionally accepted',   # Indication that the referenced offer or transaction (e.g., cargo booking or quotation request) has been accepted under conditions indicated in this message. Status is used when Buyer is accepting the Invoice under conditions stated in ‘Status Reason’ and proceed to pay accordingly unless disputed by Seller.
    'PD': 'Paid',                     # Indicates that the referenced document or transaction has been paid. Status is used only when the Buyer has initiated the payment of the invoice.AB
}

reason_op_status_action = {  # OPStatusAction - Actions that the Buyer requests from the Seller
    'NOA': 'No action required',   # No action required
    'PIN': 'Provide information',  # Missing information requested without re-issuing invoice
    'NIN': 'Issue new invoice',    # Request to re-issue a corrected invoice
    'CNF': 'Credit fully',         # Request to fully cancel the referenced invoice with a credit note
    'CNP': 'Credit partially',     # Request to issue partial credit note for corrections only
    'CNA': 'Credit the amount',    # Request to repay the amount paid on the invoice
    'OTH': 'Other',                # Requested action is not defined by code
}

reason_op_status_reason = {  # OPStatusReason - Reasons for the given status
    'NON': 'No Issue',                     # Indicates that receiver of the documents sends the message just to update the status and there are no problems with document processing
    'REF': 'References incorrect',         # Indicates that the received document did not contain references as required by the receiver for correctly routing the document for approval or processing.
    'LEG': 'Legal information incorrect',  # Information in the received document is not according to legal requirements.
    'REC': 'Receiver unknown',             # The party to which the document is addressed is not known.
    'QUA': 'Item quality insufficient',    # Unacceptable or incorrect quality
    'DEL': 'Delivery issues',              # Delivery proposed or provided is not acceptable.
    'PRI': 'Prices incorrect',             # Prices not according to previous expectation.
    'QTY': 'Quantity incorrect',           # Quantity not according to previous expectation.
    'ITM': 'Items incorrect',              # Items not according to previous expectation.
    'PAY': 'Payment terms incorrect',      # Payment terms not according to previous expectation.
    'UNR': 'Not recognized',               # Commercial transaction not recognized.
    'FIN': 'Finance incorrect',            # Finance terms not according to previous expectation.
    'PPD': 'Partially Paid',               # Payment is partially but not fully paid.
    'OTH': 'Other',                        # Reason for status is not defined by code.
}

class AccountMove(models.Model):
    _inherit = 'account.move'


    def _export_invoice_response(self, invoice):

        vals = self._export_invoice_response_vals(invoice.with_context(lang=invoice.partner_id.lang))
        errors = [
            constraint
            for constraint
            in self._export_invoice_response_constraints(invoice, vals).values() if constraint
        ]
        xml_content = self.env['ir.qweb']._render(
            'account_peppol_invoice_response.ubl_ApplicationResponse',
            vals,
        )
        return etree.tostring(cleanup_xml_node(xml_content), xml_declaration=True, encoding='UTF-8'), set(errors)
