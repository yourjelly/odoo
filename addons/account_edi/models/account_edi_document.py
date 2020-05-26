# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api, _
from psycopg2 import sql, OperationalError
import logging

_logger = logging.getLogger(__name__)


class AccountEdiDocument(models.Model):
    _name = 'account.edi.document'
    _description = 'Electronic Document for an account.move'

    edi_format_id = fields.Many2one('account.edi.format')
    edi_format_name = fields.Char(related='edi_format_id.name')
    move_id = fields.Many2one('account.move')
    state = fields.Selection([('to_send', 'To Send'), ('sent', 'Sent'), ('to_cancel', 'To Cancel'), ('cancelled', 'Cancelled')])
    error = fields.Html()
    attachment_id = fields.Many2one('ir.attachment')

    _sql_constraints = [
        (
            'unique_edi_document_by_move_by_format',
            'UNIQUE(edi_format_id, move_id)',
            'Only one edi document by move by format',
        ),
    ]

    def _post_or_cancel_synchronously(self):
        """ Post and cancel all the documents that need don't need a web-service.
        """
        self.filtered(lambda d: not d.edi_format_id._needs_web_services())._post_or_cancel()

    def _post_or_cancel_asynchronously(self):
        """Post and cancel all the documents that need a web-service. This is called by CRON.
        """
        self.filtered(lambda d: d.edi_format_id._needs_web_services())._post_or_cancel()

    def _post_or_cancel(self):
        """Post or cancel move_id (invoice or payment) by calling the related methods on edi_format_id.
           Only reconciled payments whose reconciled invoices are posted or cancelled are processed.
        """
        def _process(to_process):
            for key, vals in to_process.items():
                edi_format, state = key
                documents = vals['documents']

                try:
                    # Prevents edi documents to be sent mutliple times.
                    with self.env.cr.savepoint():
                        self._cr.execute('SELECT * FROM account_edi_document WHERE id IN %s FOR UPDATE NOWAIT', [tuple(documents.ids)])

                        edi_result = vals['method'](vals['param'])
                        vals['postprocess'](documents, edi_result)
                except OperationalError as e:
                    if e.pgcode == '55P03':
                        _logger.debug('Another transaction already locked documents rows. Cannot process documents.')
                    else:
                        raise e

        def _postprocess_post_edi_results(documents, edi_result):
            for document in documents:
                move = document.move_id
                move_result = edi_result.get(move, {})
                if move_result.get('attachment'):
                    document.write({
                        'attachment_id': move_result['attachment'].id,
                        'state': 'sent',
                        'error': False,
                    })
                else:
                    document.error = move_result.get('error', _("Error when processing the journal entry."))

        def _postprocess_cancel_edi_results(documents, edi_result):
            for document in documents:
                move = document.move_id
                if move in edi_result:
                    if edi_result[move] is True:
                        document.write({
                            'state': 'cancelled',
                            'error': False,
                        })
                    else:
                        document.error = edi_result[move] or _("Error when cancelling the journal entry.")

        # ==== Process invoices ====

        to_process = {}
        for edi_doc in self.filtered(lambda d: d.move_id.is_invoice(include_receipts=True) and d.state in ['to_send', 'to_cancel']):
            move = edi_doc.move_id
            edi_format = edi_doc.edi_format_id
            state = edi_doc.state

            key = (edi_format, state)
            to_process.setdefault(key, {
                'documents': self.env['account.edi.document'],
                'param': [],
                'method': edi_format._post_invoice_edi if state == 'to_send' else edi_format._cancel_invoice_edi,
                'postprocess': _postprocess_post_edi_results if state == 'to_send' else _postprocess_cancel_edi_results
            })
            to_process[key]['documents'] |= edi_doc
            to_process[key]['param'].append(move)

        _process(to_process)

        # ==== Process payments ====

        to_process = {}
        for edi_doc in self.filtered(lambda d: d.move_id.payment_id or d.move_id.statement_line_id and d.state in ['to_send', 'to_cancel']):
            move = edi_doc.move_id
            edi_format = edi_doc.edi_format_id
            state = edi_doc.state

            reconciled_invoices = move._get_reconciled_invoices().filtered(lambda x: edi_format in x.edi_document_ids.edi_format_id)
            reconciled_invoices_documents = reconciled_invoices.edi_document_ids.filtered(lambda x: x.edi_format_id == edi_format)
            if not reconciled_invoices or any(x.state in ['to_send', 'to_cancel'] for x in reconciled_invoices_documents):  # skip if invoices still needs processing.
                continue

            key = (edi_format, state)
            param = (move, reconciled_invoices) if state == 'to_send' else move
            to_process.setdefault(key, {
                'documents': self.env['account.edi.document'],
                'param': [],
                'method': edi_format._post_payment_edi if state == 'to_send' else edi_format._cancel_payment_edi,
                'postprocess': _postprocess_post_edi_results if state == 'to_send' else _postprocess_cancel_edi_results
            })
            to_process[key]['documents'] |= edi_doc
            to_process[key]['param'].append(param)

        _process(to_process)

    @api.model
    def action_cron_post_or_cancel_asynchronous_invoice_edi(self):
        self.search([('state', 'in', ('to_send', 'to_cancel'))])._post_or_cancel_asynchronously()
