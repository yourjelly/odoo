# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class AccountMove(models.Model):
    _inherit = 'account.move'

    edi_document_ids = fields.One2many(comodel_name='account.edi.document', inverse_name='move_id')
    edi_state = fields.Selection([('working', 'In progress'), ('done', 'Done')], string='Electronic invoicing', compute='_compute_edi_state')
    edi_error_amount = fields.Integer(compute='_compute_edi_error_amount')

    @api.depends('edi_document_ids.state')
    def _compute_edi_state(self):
        for move in self:
            move.edi_state = 'working' if move.edi_document_ids.filtered(lambda d: d.state in ['to_send', 'to_cancel']) else 'done'

    @api.depends('edi_document_ids.error')
    def _compute_edi_error_amount(self):
        for move in self:
            move.edi_error_amount = len(move.edi_document_ids.filtered(lambda d: d.error))

    ####################################################
    # Export Electronic Document
    ####################################################

    def post(self):
        # OVERRIDE
        # Set the electronic document to be posted and post immediately for synchronous formats.
        res = super().post()

        # Create the missing edi documents.
        edi_document_vals_list = []
        for move in self:
            for edi_format in move.journal_id.edi_format_ids - move.edi_document_ids.edi_format_id:
                edi_document_vals_list.append({
                    'edi_format_id': edi_format.id,
                    'move_id': move.id,
                    'state': 'to_send',
                })

        self.edi_document_ids.write({'state': 'to_send'})
        self.env['account.edi.document'].create(edi_document_vals_list)
        self.edi_document_ids._post_or_cancel_synchronously()
        return res

    def button_cancel(self):
        # OVERRIDE
        # Set the electronic document to be canceled and cancel immediately for synchronous formats.
        res = super().button_cancel()

        self.edi_document_ids.filtered(lambda d: d.state != 'to_send').write({'state': 'to_cancel'})
        self.edi_document_ids.filtered(lambda d: d.state == 'to_send').write({'state': 'cancelled', 'error': False})
        self.edi_document_ids._post_or_cancel_synchronously()
        return res

    ####################################################
    # Import Electronic Document
    ####################################################

    @api.returns('mail.message', lambda value: value.id)
    def message_post(self, **kwargs):
        # OVERRIDE
        # When posting a message, analyse the attachment to check if it is an EDI document and update the invoice
        # with the imported data.
        res = super().message_post(**kwargs)

        if len(self) != 1 or self.env.context.get('no_new_invoice') or not self.is_invoice(include_receipts=True):
            return res

        attachments = self.env['ir.attachment'].browse(kwargs.get('attachment_ids', []))
        odoobot = self.env.ref('base.partner_root')
        if attachments and self.state != 'draft':
            self.message_post(body='The invoice is not a draft, it was not updated from the attachment.',
                              message_type='comment',
                              subtype_xmlid='mail.mt_note',
                              author_id=odoobot.id)
            return res
        if attachments and self.line_ids:
            self.message_post(body='The invoice already contains lines, it was not updated from the attachment.',
                              message_type='comment',
                              subtype_xmlid='mail.mt_note',
                              author_id=odoobot.id)
            return res

        edi_formats = self.env['account.edi.format'].search([])
        for attachment in attachments:
            invoice = edi_formats._update_invoice_from_attachment(attachment, self)
            if invoice:
                break

        return res


class AccountMoveLine(models.Model):
    _inherit = 'account.move.line'

    ####################################################
    # Export Electronic Document
    ####################################################

    def reconcile(self):
        # OVERRIDE
        # Check if the move is fully reconciled and set the electronic document to be posted. Post immediately for synchronous formats.

        # Group the invoices by payments.
        reconciled_before = {}
        for move in self.move_id:
            is_payment = move.payment_id or move.statement_line_id
            if not is_payment:
                continue

            reconciled_before[move] = move._get_reconciled_invoices()

        # Perform the reconciliation.
        res = super().reconcile()

        # Create/update the payment documents.
        edi_document_vals_list = []
        existing_edi_documents = self.env['account.edi.document']
        for move, invoices_before in reconciled_before.items():
            invoices_after = move._get_reconciled_invoices()

            if set(invoices_before.ids) == set(invoices_after.ids):
                continue

            # Create/update the edi documents.
            for edi_format in invoices_after.edi_document_ids.edi_format_id:
                existing_edi_document = move.edi_document_ids.edi_format_id.filtered(lambda x: x == edi_format)
                is_edi_needed = edi_format._is_payment_edi_needed(move)

                if is_edi_needed:
                    if existing_edi_document:
                        existing_edi_document.state = 'to_send'
                        existing_edi_documents += existing_edi_document
                    else:
                        edi_document_vals_list.append({
                            'edi_format_id': edi_format.id,
                            'move_id': move.id,
                            'state': 'to_send',
                        })
                elif existing_edi_document:
                    existing_edi_document.state = 'sent'

            # Documents that are no longer necessary.
            disallowed_edi_formats = invoices_before.edi_document_ids.edi_format_id - invoices_after.edi_document_ids.edi_format_id
            move.edi_document_ids.filtered(lambda x: x.edi_format_id in disallowed_edi_formats).write({'state': 'sent'})

        existing_edi_documents += self.env['account.edi.document'].create(edi_document_vals_list)
        existing_edi_documents._post_or_cancel_synchronously()

        return res
