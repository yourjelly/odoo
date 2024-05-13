# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class AccountMove(models.Model):
    _inherit = "account.move"

    l10n_in_partner_gstin_status = fields.Char(string='GSTIN Status', compute='_compute_l10n_in_partner_gstin_status')

    @api.depends('partner_id')
    def _compute_l10n_in_partner_gstin_status(self):
        for move in self:
            move.l10n_in_partner_gstin_status = move.partner_id.l10n_in_gstin_verified_status or 'Not Checked'
