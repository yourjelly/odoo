# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models, fields


class AccountJournal(models.Model):
    _inherit = 'account.journal'

    edi_format_ids = fields.Many2many(comodel_name='account.edi.format',
                                      string='Electronic invoicing',
                                      help='Send XML/EDI invoices',
                                      domain="[('hide_on_journal', '=', 'import_export')]",
                                      compute='_compute_edi_format_ids',
                                      readonly=False, store=True)

    @api.depends('type', 'company_id')
    def _compute_edi_format_ids(self):
        edi_formats = self.env['account.edi.format'].search([])
        for journal in self:
            default_edi_formats = edi_formats.filtered(lambda f: f._enable_edi_on_journal_by_default(journal))
            journal.write({'edi_format_ids': [(6, 0, default_edi_formats.ids)]})

    def _create_invoice_from_single_attachment(self, attachment):
        invoice = self.env['account.edi.format'].search([])._create_invoice_from_attachment(attachment)
        if invoice:
            # with_context: we don't want to import the attachment since the invoice was just created from it.
            invoice.with_context(no_new_invoice=True).message_post(attachment_ids=[attachment.id])
            return invoice
        return super()._create_invoice_from_single_attachment(attachment)
