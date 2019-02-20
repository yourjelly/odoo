# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from werkzeug.urls import url_encode

from odoo import fields, models


class LunchPaymentWizard(models.Model):
    _name = 'lunch.payment.wizard'
    _description = 'Lunch Payment Wizard'

    company_id = fields.Many2one('res.company', string="Company", default=lambda self: self.env['res.company']._company_default_get())
    currency_id = fields.Many2one('res.currency', string="Currency", related='company_id.currency_id')
    amount = fields.Monetary("Amount")
    communication = fields.Char("Communication")

    def action_validate(self):
        cashmove_id = self.env['lunch.cashmove'].sudo().create({
            'amount': self.amount,
            'description': self.communication,
            'user_id': self.env.user.id,
        })
        options = {
            'currency_id': self.currency_id.id,
            'amount': self.amount,
            'reference': self.communication,
            'cashmove_id': cashmove_id.id,
        }
        return {
            'type': 'ir.actions.act_url',
            'url': '/website_payment/pay?%s' % url_encode(options),
            'target': 'self',
        }
