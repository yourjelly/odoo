# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import json

from odoo import api, fields, models, _, Command
from odoo.exceptions import UserError


class AccountMove(models.Model):
    _inherit = "account.move"

    l10n_in_advanced_payment_tax_origin_move_id = fields.Many2one('account.move', string="Advanced payment tax origin move")
    l10n_in_advanced_payment_tax_created_move_ids = fields.One2many('account.move', 'l10n_in_advanced_payment_tax_origin_move_id', string="Advanced payment tax created moves")

    def l10n_in_open_advanced_payment_entries(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': _("Advanced Payment Tax Entries"),
            'res_model': 'account.move',
            'view_mode': 'form',
            'domain': [('id', 'in', self.l10n_in_advanced_payment_tax_created_move_ids.ids)],
            'views': [(self.env.ref('account.view_move_tree').id, 'tree'), (False, 'form')],
        }

    def button_draft(self):
        res = super().button_draft()
        for move in self:
            if move.l10n_in_advanced_payment_tax_origin_move_id:
                # don't want to allow setting the Advanced Payment Tax entry to draft
                # (it'll have been reversed automatically, so no manual intervention is required),
                raise UserError(_('You cannot reset to draft a tax cash basis journal entry.'))
        return res

    def button_draft(self):
        res = super().button_draft()
        for move in self:
            if move.l10n_in_advanced_payment_tax_origin_move_id:
                # don't want to allow setting the Advanced Payment Tax entry to draft
                # (it'll have been reversed automatically, so no manual intervention is required),
                raise UserError(_('You cannot reset to draft a tax cash basis journal entry.'))
            not_canceled_advanced_payment_tax_move_ids = move.l10n_in_advanced_payment_tax_created_move_ids.filtered(lambda m: m.state != 'cancel')
            if not_canceled_advanced_payment_tax_move_ids:
                not_canceled_advanced_payment_tax_move_ids.button_cancel()
        return res

