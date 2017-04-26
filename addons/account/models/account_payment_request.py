# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import uuid

from odoo import fields, models


class AccountPaymentRequest(models.Model):
    _name = "account.payment.request"
    _rec_name = 'reference'

    access_token = fields.Char(
        string='Security Token', copy=False,
        default=lambda self: str(uuid.uuid4()), required=True)
    state = fields.Selection([
        ('open', 'Open'),
        ('pending', 'Pending'),
        ('paid', 'Paid')],
        required=True, default='open')
    invoice_id = fields.Many2one('account.invoice', string='Invoice', required=True, readonly=True)
    due_date = fields.Date(string="Due Date")
    reference = fields.Char(string="Reference")
    currency_id = fields.Many2one('res.currency', string="currency")
    company_id = fields.Many2one('res.company', string="Company")
    partner_id = fields.Many2one('res.partner', string="Customer")
    invoiced_amount = fields.Float(string="Total")
