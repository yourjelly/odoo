# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models
from odoo.fields import Command
from odoo.exceptions import UserError, AccessError, ValidationError
from odoo.tools import html_escape, html2plaintext


class AccountMove(models.Model):
    _inherit = 'account.move'

    ewaybill_id = fields.Many2one(
        comodel_name='l10n.in.ewaybill',
        string='Ewaybill', readonly=True, ondelete='cascade',
        check_company=True)

    def action_open_ewaybill_form(self):
        self.ensure_one()
        return {
            'name' : "Ewaybill",
            'res_model': 'l10n.in.ewaybill',
            'type': 'ir.actions.act_window',
            'view_mode': 'form',
            'view_id': self.env.ref('l10n_in_ewaybill.ewaybill_invoice_form_view').id,
            'context': {
                'default_account_move_id': self.id,
            }
        }
