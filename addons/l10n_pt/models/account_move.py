# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, _, fields, api
from odoo.exceptions import UserError
from odoo.tools import float_repr


class AccountMove(models.Model):
    _inherit = 'account.move'

    invoice_no = fields.Char(string='InvoiceNo', compute='_compute_invoice_no')

    @api.depends('move_type', 'sequence_prefix', 'sequence_number')
    def _compute_invoice_no(self):
        for move in self:
            move.invoice_no = move.move_type + ' ' + move.sequence_prefix + str(move.sequence_number)

    def _get_new_hash(self, secure_seq_number):
        """ Returns the hash to write on journal entries when they get posted"""
        self.ensure_one()

        # We should only hash invoices and refunds
        if self.move_type not in ('out_invoice', 'out_refund', 'in_invoice', 'in_refund'):
            return ""

        # Get the only one exact previous move in the securisation sequence
        prev_move = self.search([('state', '=', 'posted'),
                                 ('move_type', '=', self.move_type),
                                 ('company_id', '=', self.company_id.id),
                                 ('secure_sequence_number', '!=', 0)],
                                limit=1,
                                order='secure_sequence_number DESC',
                                )
        if prev_move and len(prev_move) != 1:
            raise UserError(
               _('An error occured when computing the inalterability. Impossible to get the unique previous posted journal entry.'))

        invoice_date = self.invoice_date.strftime('%Y-%m-%d')
        system_entry_date = self.create_date.strftime("%Y-%m-%dT%H:%M:%S")
        gross_total = float_repr(self.amount_total, 2)
        previous_hash = prev_move.inalterable_hash if prev_move else ""
        message = f"{invoice_date};{system_entry_date};{self.invoice_no};{gross_total};{previous_hash}"
        return self._compute_hash(message)

    def _compute_hash(self, message):
        self.ensure_one()
        # This is only temporary
        hash_string = message[message.rfind(';')+1:] + "I"
        return hash_string
