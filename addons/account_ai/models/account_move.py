# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
from odoo.exceptions import UserError


class AccountMoveLine(models.Model):
    _inherit = 'account.move.line'

    unusual_amount = fields.Selection([('true', 'True'), ('false', 'False'), ('checked', 'Checked')], default='false', required=True)

    def action_account_ai_open(self):
        ctx = dict(self.env.context)
        if self.partner_id:
            ctx['search_default_partner_id'] = [self.partner_id.id]
        if self.account_id:
            ctx['search_default_account_id'] = [self.account_id.id]
        return {
            'name': self.display_name,
            'res_model': 'account.move.line',
            'view_mode': 'tree,form',
            'domain': [('company_id', '=', self.company_id.id)],
            'type': 'ir.actions.act_window',
            'target': 'current',
            'context': ctx,
        }

    def action_account_ai_remove(self):
        self.write({'unusual_amount': 'checked'})

    def action_account_ai_temp_remove(self):
        self.write({'unusual_amount': 'false'})
