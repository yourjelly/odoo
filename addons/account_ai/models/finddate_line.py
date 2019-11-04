# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
from odoo.exceptions import UserError


class AIWizardProposition(models.Model):
    _name = 'account.ai.finddate.line'
    _description = 'Deduced things'

    company_id = fields.Many2one(related='config_id.company_id', store=True, readonly=True)
    config_id = fields.Many2one('account.ai.config', required=True)
    account_id = fields.Many2one('account.account')
    partner_id = fields.Many2one('res.partner')
    range_up = fields.Float()
    range_down = fields.Float()
    date = fields.Date()
    date_str = fields.Char()

    def action_open(self):
        self.ensure_one()
        domain = [('account_id', '=', self.account_id.id), ('partner_id', '=', self.partner_id.id)]
        if self.range_up:
            domain += [('balance', '<=', self.range_up)]
        if self.range_down:
            domain += [('balance', '>=', self.range_down)]
        return {
            'name': "{account}, {partner} [{down},{up}], {date}".format(
                account=self.account_id.display_name,
                partner=self.partner_id.display_name,
                down=self.range_down,
                up=self.range_up,
                date=self.date_str,
            ),
            'type': 'ir.actions.act_window',
            'res_model': 'account.move.line',
            'view_mode': 'tree,form',
            'domain': domain,
        }

    def action_create(self):
        self.ensure_one()
        raise UserError("Not implemented yet, dont be greedy")
