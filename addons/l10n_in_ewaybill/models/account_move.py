# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models
from odoo.fields import Command
from odoo.exceptions import UserError, AccessError, ValidationError
from odoo.tools import html_escape, html2plaintext


class AccountMove(models.Model):
    _inherit = 'account.move'

    l10n_in_ewaybill_ids = fields.One2many('l10n.in.ewaybill', 'account_move_id', string='e-Way bill', readonly=True)

    def action_open_ewaybill_form(self):
        self.ensure_one()
        action = {
            'name': "e-Way bill",
            'res_model': 'l10n.in.ewaybill',
            'type': 'ir.actions.act_window',
            'view_mode': 'form',
            'context': {
                'default_account_move_id': self.id,
            }
        }
        if len(self.l10n_in_ewaybill_ids) == 1:
            action['res_id'] = self.l10n_in_ewaybill_ids.id
        elif self.l10n_in_ewaybill_ids:
            action['view_mode'] = 'tree,form'
            action['domain'] = [('id', 'in', self.l10n_in_ewaybill_ids.ids)]
        return action
