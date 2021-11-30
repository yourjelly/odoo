# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models
from re import sub as regex_sub


class AccountMove(models.Model):
    _inherit = 'account.move'

    l10n_es_tbai_is_required = fields.Boolean(
        string="Is the Bask EDI (TicketBai) needed",
        compute='_compute_l10n_es_tbai_is_required'
    )
    l10n_es_tbai_previous_invoice_id = fields.Many2one(string="Previous invoice on chain", comodel_name="account.move", copy=False, readonly=True)
    l10n_es_tbai_id = fields.Char(string="TicketBaiID", copy=False, readonly=True)
    l10n_es_tbai_signature = fields.Char(string="Signature value of XML", copy=False, readonly=True)
    l10n_es_registration_date = fields.Date(
        string="Registration Date",
        help="Technical field to keep the date the invoice was sent the first time as the date the invoice was "
             "registered into the system.",
    )
    l10n_es_tbai_sequence = fields.Char(string="TicketBai sequence", compute="_get_l10n_es_tbai_sequence")
    l10n_es_tbai_number = fields.Char(string="TicketBai number", compute="_get_l10n_es_tbai_number")

    # -------------------------------------------------------------------------
    # COMPUTE METHODS
    # -------------------------------------------------------------------------

    @api.depends('move_type', 'company_id')
    def _compute_l10n_es_tbai_is_required(self):
        for move in self:
            # TODO find out what moves other than invoices require tbai
            move.l10n_es_tbai_is_required = move.is_invoice() \
                and move.country_code == 'ES' \
                and move.company_id.l10n_es_tbai_tax_agency

    @api.depends('l10n_es_tbai_is_required')
    def _compute_edi_show_cancel_button(self):
        # OVERRIDE
        super()._compute_edi_show_cancel_button()
        for move in self.filtered('l10n_es_tbai_is_required'):
            move.edi_show_cancel_button = False

    def _get_l10n_es_tbai_sequence(self):
        for record in self:
            sequence, _ = record.name.rsplit('/', 1)
            sequence = regex_sub(r"[^0-9A-Za-z.\_\-\/]", "", sequence)  # remove forbidden characters
            sequence = regex_sub(r"[\s]+", " ", sequence)  # no more than once consecutive whitespace allowed
            # TODO (optional) issue warning if sequence uses chars out of ([0123456789ABCDEFGHJKLMNPQRSTUVXYZ.\_\-\/ ])
            record.write({'l10n_es_tbai_sequence': sequence})

    def _get_l10n_es_tbai_number(self):
        for record in self:
            _, number = self.name.rsplit('/', 1)
            number = regex_sub(r"[^0-9]", "", number)  # remove non-decimal characters
            record.write({'l10n_es_tbai_number': number})
